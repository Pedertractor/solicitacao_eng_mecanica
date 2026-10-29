import { simulationConversionEligibility } from '../../lib/simulation-conversion.js';
import { workflowKind } from '../../lib/commercial-simulation.js';
import { notifySolicitationCompleted } from '../../lib/solicitation-mail.js';
import {
  $Enums,
  Prisma,
  PrismaClient,
  type SolicitationWorkflowStage,
} from '../../generated/prisma/client.js';

import { HttpError } from '../../https/errors/index.js';
import { workflowPrerequisitesDone, type PcpStage } from '../../lib/workflow-dependencies.js';

export type CreateWorkflowStageInput = {
  stage: $Enums.WorkflowStage;
  order: number;
  status?: $Enums.WorkflowStageStatus;
  plannedStartAt?: Date | null;
  plannedEndAt?: Date | null;
  plannedDurationPercentage?: number | null;
};

export type WorkflowStageWithSolicitation = SolicitationWorkflowStage & {
  solicitation: {
    id: string;
    trackingCode: string;
    title: string;
    department: $Enums.UserDepartment;
    processInstructionRequester: string | null;
    status: $Enums.SolicitationStatus;
    kairoTeamId: string | null;
    kairoCardId: string | null;
    kairoCardIds: string | null;
    requiresTooling: boolean;
  };
};

const solicitationSelect = {
  id: true,
  trackingCode: true,
  title: true,
  department: true,
  processInstructionRequester: true,
  status: true,
  kairoTeamId: true,
  kairoCardId: true,
  kairoCardIds: true,
  requiresTooling: true,
} satisfies Prisma.SolicitationSelect;

export class WorkflowStagePrismaRepository {
  constructor(private prisma: PrismaClient | Prisma.TransactionClient) {}

  async createStages(
    solicitationId: string,
    stages: CreateWorkflowStageInput[],
  ): Promise<SolicitationWorkflowStage[]> {
    if (stages.length === 0) return [];

    await this.prisma.solicitationWorkflowStage.createMany({
      data: stages.map((stage) => ({
        solicitationId,
        stage: stage.stage,
        order: stage.order,
        status: stage.status ?? $Enums.WorkflowStageStatus.PENDING,
        plannedStartAt: stage.plannedStartAt ?? null,
        plannedEndAt: stage.plannedEndAt ?? null,
        plannedDurationPercentage:
          stage.plannedDurationPercentage != null
            ? new Prisma.Decimal(stage.plannedDurationPercentage)
            : null,
      })),
    });

    return this.findBySolicitationId(solicitationId);
  }

  async findBySolicitationId(
    solicitationId: string,
  ): Promise<SolicitationWorkflowStage[]> {
    return this.prisma.solicitationWorkflowStage.findMany({
      where: { solicitationId },
      orderBy: { order: 'asc' },
    });
  }

  async findStage(
    solicitationId: string,
    stage: $Enums.WorkflowStage,
  ): Promise<SolicitationWorkflowStage | null> {
    return this.prisma.solicitationWorkflowStage.findUnique({
      where: {
        solicitationId_stage: { solicitationId, stage },
      },
    });
  }

  /** Serialize branch completions so simultaneous Kairo updates cannot miss the join. */
  private async withWorkflowLock<T>(
    solicitationId: string,
    action: (repo: WorkflowStagePrismaRepository) => Promise<T>,
    resolve: boolean | ((value: T) => boolean) = false,
    completionActorId?: string,
  ): Promise<T> {
    const run = async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT "id" FROM "Solicitation" WHERE "id" = ${solicitationId} FOR UPDATE`;
      return action(new WorkflowStagePrismaRepository(tx));
    };
    if ('$transaction' in this.prisma) {
      const result = await this.prisma.$transaction(async (tx) => {
        const value = await run(tx);
        const completed = (typeof resolve === 'function' ? resolve(value) : resolve) ? await tx.solicitation.updateMany({
          where: { id: solicitationId, status: { notIn: ['COMPLETED', 'CANCELLED', 'DELETED'] },
            workflowStages: { some: {}, every: { status: { in: ['DONE', 'REJECTED'] } } } },
          data: { status: 'COMPLETED', statusUpdatedAt: new Date(), ...(completionActorId ? { statusUpdatedByUserId: completionActorId } : {}) },
        }) : { count: 0 };
        const payload = completed.count ? await tx.solicitation.findUnique({ where: { id: solicitationId } }) : null;
        return { value, payload };
      });
      if (result.payload) await notifySolicitationCompleted(result.payload);
      return result.value;
    }
    return run(this.prisma);
  }

  private async refreshReadyStages(solicitationId: string, requiresTooling: boolean) {
    const stages = await this.findBySolicitationId(solicitationId);
    const parent = await this.prisma.solicitation.findUniqueOrThrow({ where: { id: solicitationId } });
    const kind = workflowKind({ ...parent, workflowStages: stages });
    for (const stage of stages) {
      if (stage.status !== 'PENDING' && stage.status !== 'READY') continue;
      // Engineering is available immediately and keeps its existing Kairo pending state.
      if (stage.stage === 'ENGENHARIA') continue;
      const status = workflowPrerequisitesDone(stages, stage.stage, requiresTooling, kind)
        ? $Enums.WorkflowStageStatus.READY : $Enums.WorkflowStageStatus.PENDING;
      if (status !== stage.status) {
        await this.prisma.solicitationWorkflowStage.update({ where: { id: stage.id }, data: { status } });
      }
    }
    return this.findBySolicitationId(solicitationId);
  }

  private async transitionStage(
    solicitationId: string,
    stageKind: $Enums.WorkflowStage,
    status: 'IN_PROGRESS' | 'DONE',
    at: Date,
    completedByUserId?: string,
    manual = false,
  ): Promise<SolicitationWorkflowStage[]> {
    return this.withWorkflowLock(solicitationId, async (repo) => {
      const parent = await repo.prisma.solicitation.findUniqueOrThrow({
        where: { id: solicitationId },
      });
      const stages = await repo.findBySolicitationId(solicitationId);
      const stage = stages.find((item) => item.stage === stageKind);
      const closed = ['COMPLETED', 'CANCELLED', 'DELETED'].includes(parent.status);
      const allowed = stage && !closed && stage.status !== 'DONE' && !['CANCELLED', 'REJECTED'].includes(stage.status)
        && workflowPrerequisitesDone(stages, stageKind, parent.requiresTooling, workflowKind({ ...parent, workflowStages: stages }));
      if (!allowed) {
        if (manual) throw new HttpError('Etapa indisponível ou com pré-requisitos pendentes', 400);
        return stages;
      }
      if (manual && (status === 'IN_PROGRESS'
        ? !['READY', 'PENDING'].includes(stage.status)
        : stage.status !== 'IN_PROGRESS')) {
        throw new HttpError('Inicie a etapa antes de concluí-la', 400);
      }
      if (status === 'IN_PROGRESS' && stage.status === 'IN_PROGRESS') return stages;
      const completedBy = completedByUserId ?? stage.kairoSyncedByUserId;
      await repo.prisma.solicitationWorkflowStage.update({
        where: { id: stage.id },
        data: {
          status,
          actualStartAt: stage.actualStartAt ?? at,
          ...(status === 'DONE' ? { actualEndAt: at, ...(completedBy ? { completedByUserId: completedBy } : {}) } : {}),
        },
      });
      return repo.refreshReadyStages(solicitationId, parent.requiresTooling);
    }, status === 'DONE', completedByUserId);
  }

  async convertCommercialSimulation(id: string) {
    return this.withWorkflowLock(id, async (repo) => {
      const row = await repo.prisma.solicitation.findUniqueOrThrow({ where: { id }, include: { workflowStages: true } });
      const eligibility = simulationConversionEligibility(row);
      if (!eligibility.eligible) return eligibility;
      await repo.prisma.solicitationWorkflowStage.deleteMany({ where: { solicitationId: id, stage: { not: 'ENGENHARIA' } } });
      await repo.prisma.solicitation.update({ where: { id }, data: { requiresTooling: false, directTooling: false } });
      return eligibility;
    }, (result) => result.eligible);
  }

  async addSimulationTooling(id: string) {
    return this.withWorkflowLock(id, async (repo) => {
      const parent = await repo.prisma.solicitation.findUnique({ where: { id }, include: { workflowStages: true } });
      if (!parent) throw new HttpError('Solicitação não encontrada', 404);
      if (workflowKind(parent) !== 'COMMERCIAL_SIMULATION') throw new HttpError('Inclusão disponível apenas para Simulação Comercial', 400);
      if (['COMPLETED', 'CANCELLED', 'DELETED'].includes(parent.status)) throw new HttpError('Solicitação encerrada', 400);
      if (parent.workflowStages.some((stage) => stage.stage === 'FERRAMENTARIA')) return;
      const engineering = parent.workflowStages.find((stage) => stage.stage === 'ENGENHARIA')!;
      if (!['PENDING', 'READY', 'IN_PROGRESS'].includes(engineering.status)) throw new HttpError('Etapa de Engenharia encerrada', 400);
      await repo.prisma.solicitationWorkflowStage.create({ data: { solicitationId: id, stage: 'FERRAMENTARIA', order: 1, status: 'READY' } });
      await repo.prisma.solicitation.update({ where: { id }, data: { requiresTooling: true } });
    });
  }

  async markEngineeringStarted(id: string, at: Date) {
    return this.transitionStage(id, 'ENGENHARIA', 'IN_PROGRESS', at);
  }

  async markEngineeringFinished(id: string, at: Date) {
    return this.transitionStage(id, 'ENGENHARIA', 'DONE', at);
  }

  async markToolingStarted(id: string, at: Date) {
    return this.transitionStage(id, 'FERRAMENTARIA', 'IN_PROGRESS', at);
  }

  async markToolingFinished(id: string, at: Date) {
    return this.transitionStage(id, 'FERRAMENTARIA', 'DONE', at);
  }

  async transitionPcpStage(id: string, stage: PcpStage, status: 'IN_PROGRESS' | 'DONE', at: Date, userId?: string, manual = false) {
    return this.transitionStage(id, stage, status, at, userId, manual);
  }

  async transitionQualityStage(id: string, status: 'IN_PROGRESS' | 'DONE', at: Date, userId?: string, manual = false) {
    return this.transitionStage(id, 'QUALIDADE', status, at, userId, manual);
  }

  async setToolingKairo(
    solicitationId: string,
    data: {
      kairoTeamId: string;
      kairoCardIds: string;
      kairoSyncedByUserId: string;
    },
  ): Promise<SolicitationWorkflowStage> {
    return this.prisma.solicitationWorkflowStage.update({
      where: {
        solicitationId_stage: {
          solicitationId,
          stage: $Enums.WorkflowStage.FERRAMENTARIA,
        },
      },
      data: {
        kairoTeamId: data.kairoTeamId,
        kairoCardIds: data.kairoCardIds,
        kairoSyncedAt: new Date(),
        kairoSyncedByUserId: data.kairoSyncedByUserId,
      },
    });
  }

  async clearToolingKairo(solicitationId: string) {
    return this.withWorkflowLock(solicitationId, async (repo) => repo.prisma.solicitationWorkflowStage.updateMany({
      where: { solicitationId, stage: 'FERRAMENTARIA', status: { notIn: ['DONE', 'CANCELLED', 'REJECTED'] },
        solicitation: { status: { notIn: ['COMPLETED', 'CANCELLED', 'DELETED'] } } },
      data: { kairoTeamId: null, kairoCardIds: null, kairoSyncedAt: null, kairoSyncedByUserId: null,
        status: 'READY', actualStartAt: null, actualEndAt: null },
    }));
  }

  async markSampleStarted(id: string, at: Date, userId?: string) {
    return this.transitionStage(id, 'AMOSTRA', 'IN_PROGRESS', at, userId);
  }

  async markSampleFinished(id: string, at: Date, userId?: string) {
    return this.transitionStage(id, 'AMOSTRA', 'DONE', at, userId);
  }

  async declineStage(id: string, stageKind: $Enums.WorkflowStage, reason: string, userId: string, userName: string) {
    if (!reason.trim()) throw new HttpError('Informe o motivo da recusa', 400);
    return this.withWorkflowLock(id, async (repo) => {
      const parent = await repo.prisma.solicitation.findUniqueOrThrow({ where: { id }, select: { status: true, requiresTooling: true } });
      if (['COMPLETED', 'CANCELLED', 'DELETED'].includes(parent.status)) throw new HttpError('Solicitação encerrada', 400);
      const stage = await repo.findStage(id, stageKind);
      if (!stage) throw new HttpError('Etapa não encontrada', 404);
      if (!['PENDING', 'READY', 'IN_PROGRESS'].includes(stage.status)) throw new HttpError('Etapa já encerrada', 400);
      await repo.prisma.solicitationWorkflowStage.update({ where: { id: stage.id }, data: {
        status: 'REJECTED', rejectionReason: reason.trim(), rejectedAt: new Date(), rejectedByUserId: userId, rejectedByName: userName,
      } });
      return repo.refreshReadyStages(id, parent.requiresTooling);
    }, true, userId);
  }

  async setPcpKairo(id: string, stage: PcpStage, data: { kairoTeamId: string; kairoCardIds: string; kairoSyncedByUserId: string }) {
    return this.prisma.solicitationWorkflowStage.update({
      where: { solicitationId_stage: { solicitationId: id, stage } },
      data: { ...data, kairoSyncedAt: new Date() },
    });
  }

  async clearPcpKairo(id: string, stage: PcpStage) {
    return this.prisma.solicitationWorkflowStage.updateMany({
      where: { solicitationId: id, stage, status: { notIn: ['DONE', 'CANCELLED', 'REJECTED'] } },
      data: { kairoTeamId: null, kairoCardIds: null, kairoSyncedAt: null, kairoSyncedByUserId: null,
        status: 'READY', actualStartAt: null, actualEndAt: null },
    });
  }

  async findPendingPcpKairoSync() {
    return this.prisma.solicitationWorkflowStage.findMany({
      where: { stage: { in: ['PCP_FERRAMENTARIA', 'PCP_AMOSTRA'] },
        kairoTeamId: { not: null }, kairoCardIds: { not: null },
        status: { in: ['PENDING', 'READY', 'IN_PROGRESS'] },
        solicitation: { status: { notIn: ['COMPLETED', 'CANCELLED', 'DELETED'] } } },
      orderBy: { updatedAt: 'asc' },
    });
  }
  async setQualityKairo(id: string, data: { kairoTeamId: string; kairoCardIds: string; kairoSyncedByUserId: string }) {
    return this.prisma.solicitationWorkflowStage.update({
      where: { solicitationId_stage: { solicitationId: id, stage: 'QUALIDADE' } },
      data: { ...data, kairoSyncedAt: new Date() },
    });
  }

  async clearQualityKairo(id: string) {
    return this.withWorkflowLock(id, async (repo) => {
      return repo.prisma.solicitationWorkflowStage.updateMany({
        where: { solicitationId: id, stage: 'QUALIDADE', status: { notIn: ['DONE', 'CANCELLED', 'REJECTED'] },
          solicitation: { status: { notIn: ['COMPLETED', 'CANCELLED', 'DELETED'] } } },
        data: { kairoTeamId: null, kairoCardIds: null, kairoSyncedAt: null, kairoSyncedByUserId: null,
          status: 'READY', actualStartAt: null, actualEndAt: null },
      });
    });
  }

  async findPendingQualityKairoSync() {
    return this.prisma.solicitationWorkflowStage.findMany({
      where: { stage: { in: ['QUALIDADE'] },
        kairoTeamId: { not: null }, kairoCardIds: { not: null },
        status: { in: ['PENDING', 'READY', 'IN_PROGRESS'] },
        solicitation: { status: { notIn: ['COMPLETED', 'CANCELLED', 'DELETED'] } } },
      orderBy: { updatedAt: 'asc' },
    });
  }

  async setSampleKairo(
    solicitationId: string,
    data: {
      kairoTeamId: string;
      kairoCardIds: string;
      kairoSyncedByUserId: string;
    },
  ): Promise<SolicitationWorkflowStage> {
    return this.prisma.solicitationWorkflowStage.update({
      where: {
        solicitationId_stage: {
          solicitationId,
          stage: $Enums.WorkflowStage.AMOSTRA,
        },
      },
      data: {
        kairoTeamId: data.kairoTeamId,
        kairoCardIds: data.kairoCardIds,
        kairoSyncedAt: new Date(),
        kairoSyncedByUserId: data.kairoSyncedByUserId,
      },
    });
  }

  async clearSampleKairo(solicitationId: string) {
    return this.withWorkflowLock(solicitationId, async (repo) => repo.prisma.solicitationWorkflowStage.updateMany({
      where: { solicitationId, stage: 'AMOSTRA', status: { notIn: ['DONE', 'CANCELLED', 'REJECTED'] },
        solicitation: { status: { notIn: ['COMPLETED', 'CANCELLED', 'DELETED'] } } },
      data: { kairoTeamId: null, kairoCardIds: null, kairoSyncedAt: null, kairoSyncedByUserId: null,
        status: 'READY', actualStartAt: null, actualEndAt: null },
    }));
  }

  async findPendingSampleKairoSync(): Promise<WorkflowStageWithSolicitation[]> {
    return this.prisma.solicitationWorkflowStage.findMany({
      where: {
        stage: $Enums.WorkflowStage.AMOSTRA,
        kairoTeamId: { not: null },
        kairoCardIds: { not: null },
        status: {
          in: [
            $Enums.WorkflowStageStatus.PENDING,
            $Enums.WorkflowStageStatus.READY,
            $Enums.WorkflowStageStatus.IN_PROGRESS,
          ],
        },
        solicitation: {
          status: {
            notIn: [
              $Enums.SolicitationStatus.COMPLETED,
              $Enums.SolicitationStatus.CANCELLED,
              $Enums.SolicitationStatus.DELETED,
            ],
          },
        },
      },
      include: {
        solicitation: { select: solicitationSelect },
      },
      orderBy: { updatedAt: 'asc' },
    });
  }

  async cancelOpenStages(solicitationId: string): Promise<number> {
    const result = await this.prisma.solicitationWorkflowStage.updateMany({
      where: {
        solicitationId,
        status: {
          notIn: [
            $Enums.WorkflowStageStatus.DONE,
            $Enums.WorkflowStageStatus.CANCELLED,
            $Enums.WorkflowStageStatus.REJECTED,
          ],
        },
      },
      data: {
        status: $Enums.WorkflowStageStatus.CANCELLED,
      },
    });
    return result.count;
  }

  async findPendingToolingKairoSync(): Promise<WorkflowStageWithSolicitation[]> {
    return this.prisma.solicitationWorkflowStage.findMany({
      where: {
        stage: $Enums.WorkflowStage.FERRAMENTARIA,
        kairoTeamId: { not: null },
        kairoCardIds: { not: null },
        status: {
          in: [
            $Enums.WorkflowStageStatus.PENDING,
            $Enums.WorkflowStageStatus.READY,
            $Enums.WorkflowStageStatus.IN_PROGRESS,
          ],
        },
        solicitation: {
          status: {
            notIn: [
              $Enums.SolicitationStatus.COMPLETED,
              $Enums.SolicitationStatus.CANCELLED,
              $Enums.SolicitationStatus.DELETED,
            ],
          },
        },
      },
      include: {
        solicitation: { select: solicitationSelect },
      },
      orderBy: { updatedAt: 'asc' },
    });
  }

  async summary(
    scope?: Prisma.SolicitationWhereInput,
  ): Promise<
    Array<{
      stage: $Enums.WorkflowStage;
      status: $Enums.WorkflowStageStatus;
      count: number;
    }>
  > {
    const rows = await this.prisma.solicitationWorkflowStage.groupBy({
      by: ['stage', 'status'],
      where: {
        solicitation: {
          AND: [
            {
              status: {
                notIn: [
                  $Enums.SolicitationStatus.DELETED,
                  $Enums.SolicitationStatus.CANCELLED,
                ],
              },
            },
            scope ?? {},
          ],
        },
      },
      _count: { _all: true },
    });

    return rows.map((row) => ({
      stage: row.stage,
      status: row.status,
      count: row._count._all,
    }));
  }
}
