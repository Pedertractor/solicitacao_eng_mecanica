import { isCommercialSimulation, workflowKind } from '../lib/commercial-simulation.js';
import { isProcessEngineeringLead, isSuperAdmin } from '../auth/access-policy.js';
import { HttpError } from '../https/errors/index.js';
import { prisma } from '../lib/prisma.js';
import { $Enums } from '../generated/prisma/client.js';
import {
  type AccessActor,
  canAccessSolicitation,
  canDeclineWorkflowStage,
  canManagePcpStage,
  canManageQualityStage,
  canManageSampleStage,
  canManageToolingStage,
  solicitationScope,
  visibleWorkflowStages,
} from '../auth/access-policy.js';
import {
  KAIRO_INTEGRATION_SOURCE,
  type KairoActivity,
} from '../integrations/kairo-client.js';
import {
  engineeringStagePlannedEndAt,
  calcularDataLimiteDate,
  WORKFLOW_ENGINEERING_PERCENTAGE,
} from '../lib/process-instruction.js';
import {
  SolicitationPrismaRepository,
  type SolicitationWithWorkflow,
} from '../repositories/prisma/solicitation-repository.js';
import {
  WorkflowStagePrismaRepository,
  type CreateWorkflowStageInput,
} from '../repositories/prisma/workflow-stage-repository.js';
import { KairoCredentialService } from './kairo-credential-service.js';
import { workflowPrerequisitesDone, type PcpStage } from '../lib/workflow-dependencies.js';

const KAIRO_STARTED_STATUSES = new Set(['IN_PROGRESS', 'PAUSED']);

function splitCommaList(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function kairoObservedAt(
  activity: Pick<KairoActivity, 'startedAt' | 'finishedAt' | 'updatedAt'>,
  prefer: 'start' | 'finish' = 'finish',
): Date {
  const raw =
    prefer === 'start'
      ? (activity.startedAt ?? activity.updatedAt)
      : (activity.finishedAt ?? activity.updatedAt);
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export function mapWorkflowStage(row: {
  id: string;
  stage: $Enums.WorkflowStage;
  status: $Enums.WorkflowStageStatus;
  order: number;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  plannedDurationPercentage: { toString(): string } | null;
  actualStartAt: Date | null;
  actualEndAt: Date | null;
  kairoTeamId: string | null;
  kairoCardIds: string | null;
  kairoSyncedAt: Date | null;
  kairoSyncedByUserId: string | null;
  completedByUserId: string | null;
  rejectionReason?: string | null;
  rejectedAt?: Date | null;
  rejectedByUserId?: string | null;
  rejectedByName?: string | null;
}) {
  return {
    id: row.id,
    stage: row.stage,
    status: row.status,
    order: row.order,
    plannedStartAt: row.plannedStartAt?.toISOString() ?? null,
    plannedEndAt: row.plannedEndAt?.toISOString() ?? null,
    plannedDurationPercentage:
      row.plannedDurationPercentage?.toString() ?? null,
    actualStartAt: row.actualStartAt?.toISOString() ?? null,
    actualEndAt: row.actualEndAt?.toISOString() ?? null,
    kairoTeamId: row.kairoTeamId,
    kairoCardIds: row.kairoCardIds,
    kairoSyncedAt: row.kairoSyncedAt?.toISOString() ?? null,
    kairoSyncedByUserId: row.kairoSyncedByUserId,
    completedByUserId: row.completedByUserId,
    rejectionReason: row.rejectionReason ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectedByUserId: row.rejectedByUserId ?? null,
    rejectedByName: row.rejectedByName ?? null,
  };
}

export function mapWorkflow(row: {
  department?: string;
  processInstructionRequester?: string | null;
  processInstructionType?: string | null;
  requiresTooling: boolean;
  workflowStages?: Array<Parameters<typeof mapWorkflowStage>[0]>;
}) {
  const stages = row.workflowStages ?? [];
  if (stages.length === 0) return null;
  return {
    kind: workflowKind(row),
    requiresTooling: row.requiresTooling,
    stages: stages.map(mapWorkflowStage),
  };
}

export class WorkflowService {
  buildStagesForCreate(input: {
    department?: string;
    requester: string;
    process: string;
    type: string;
    deliveryDateIso: string | null;
    requiresTooling: boolean;
    directTooling?: boolean;
    now?: Date;
  }): CreateWorkflowStageInput[] {
    if (input.department === 'FERRAMENTARIA') {
      const now = input.now ?? new Date();
      return [{ stage: 'FERRAMENTARIA', order: 0, status: 'READY',
        plannedStartAt: now, plannedEndAt: calcularDataLimiteDate(10, now) }];
    }
    const simulation = isCommercialSimulation({ department: 'DESENVOLVIMENTO_PROCESSOS',
      processInstructionRequester: input.requester, processInstructionType: input.type });
    if (input.directTooling && !simulation) {
      return [
        { stage: $Enums.WorkflowStage.PCP_FERRAMENTARIA, order: 0, status: $Enums.WorkflowStageStatus.READY },
        { stage: $Enums.WorkflowStage.FERRAMENTARIA, order: 1, status: $Enums.WorkflowStageStatus.PENDING },
      ];
    }
    const now = input.now ?? new Date();
    const plannedEndAt = engineeringStagePlannedEndAt({
      requester: input.requester,
      process: input.process,
      type: input.type,
      deliveryDateIso: input.deliveryDateIso,
      now,
    });

    const stages: CreateWorkflowStageInput[] = [
      {
        stage: $Enums.WorkflowStage.ENGENHARIA,
        order: 0,
        status: $Enums.WorkflowStageStatus.PENDING,
        plannedStartAt: now,
        plannedEndAt,
        plannedDurationPercentage: WORKFLOW_ENGINEERING_PERCENTAGE,
      },
    ];

    if (simulation) return stages;

    if (input.requiresTooling) {
      stages.push({
        stage: $Enums.WorkflowStage.PCP_FERRAMENTARIA,
        order: 1,
        status: $Enums.WorkflowStageStatus.READY,
      });
      stages.push({
        stage: $Enums.WorkflowStage.FERRAMENTARIA,
        order: 2,
        status: $Enums.WorkflowStageStatus.PENDING,
      });
    }

    stages.push({
      stage: $Enums.WorkflowStage.PCP_AMOSTRA,
      order: input.requiresTooling ? 3 : 1,
      status: $Enums.WorkflowStageStatus.PENDING,
    });

    stages.push({
      stage: $Enums.WorkflowStage.QUALIDADE,
      order: input.requiresTooling ? 4 : 2,
      status: $Enums.WorkflowStageStatus.READY,
    });

    stages.push({
      stage: $Enums.WorkflowStage.AMOSTRA,
      order: input.requiresTooling ? 5 : 3,
      status: $Enums.WorkflowStageStatus.PENDING,
    });

    return stages;
  }

  async applyEngineeringKairoState(
    solicitation: SolicitationWithWorkflow,
    cards: Array<{
      status: string | undefined;
      deletedAt: string | null;
      startedAt?: string | null;
      finishedAt?: string | null;
      updatedAt?: string | null;
    }>,
  ): Promise<SolicitationWithWorkflow> {
    const engineering = solicitation.workflowStages.find(
      (stage) => stage.stage === $Enums.WorkflowStage.ENGENHARIA,
    );
    if (!engineering) return solicitation;
    if (
      engineering.status === $Enums.WorkflowStageStatus.DONE ||
      engineering.status === $Enums.WorkflowStageStatus.CANCELLED || engineering.status === $Enums.WorkflowStageStatus.REJECTED
    ) {
      return solicitation;
    }

    const activeCards = cards.filter((card) => !card.deletedAt);
    if (activeCards.length === 0) return solicitation;

    const workflowRepo = new WorkflowStagePrismaRepository(prisma);
    const solicitationRepo = new SolicitationPrismaRepository(prisma);

    if (activeCards.every((card) => card.status === 'DONE')) {
      const finishedAt = kairoObservedAt(activeCards[0]!, 'finish');
      await workflowRepo.markEngineeringFinished(solicitation.id, finishedAt);
      const refreshed = await solicitationRepo.findById(solicitation.id);
      return refreshed ?? solicitation;
    }

    if (
      engineering.status === $Enums.WorkflowStageStatus.PENDING &&
      activeCards.some(
        (card) => card.status && KAIRO_STARTED_STATUSES.has(card.status),
      )
    ) {
      const startedCard = activeCards.find(
        (card) => card.status && KAIRO_STARTED_STATUSES.has(card.status),
      )!;
      await workflowRepo.markEngineeringStarted(
        solicitation.id,
        kairoObservedAt(startedCard, 'start'),
      );
      const refreshed = await solicitationRepo.findById(solicitation.id);
      return refreshed ?? solicitation;
    }

    return solicitation;
  }

  async addTooling(id: string, userId: string) {
    const actor = await this.loadActor(userId);
    if (!isSuperAdmin(actor.role) && !isProcessEngineeringLead(actor)) throw new HttpError('Sem permissão para adicionar Ferramentaria', 403);
    const existing = await new SolicitationPrismaRepository(prisma).findById(id);
    if (!existing || !canAccessSolicitation(actor, existing)) throw new HttpError('Solicitação não encontrada', 404);
    await new WorkflowStagePrismaRepository(prisma).addSimulationTooling(id);
    return (await new SolicitationPrismaRepository(prisma).findById(id))!;
  }

  async sendToolingToKairo(
    id: string,
    input: {
      teamId: string;
      title?: string;
      description?: string;
      tagId?: string;
    },
    actingUserId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Solicitation" WHERE "id" = ${id} FOR UPDATE`;
      const actor = await this.loadActor(actingUserId);
      if (!canManageToolingStage(actor)) {
        throw new HttpError('Sem permissão para enviar ferramentaria ao Kairo', 403);
      }

      const solicitationRepo = new SolicitationPrismaRepository(tx);
      const existing = await solicitationRepo.findById(id);
      if (!existing || !canAccessSolicitation(actor, existing)) {
        throw new HttpError('Solicitação não encontrada', 404);
      }

      const tooling = existing.workflowStages.find(
        (stage) => stage.stage === $Enums.WorkflowStage.FERRAMENTARIA,
      );

      if (!tooling) {
        throw new HttpError('Esta solicitação não possui etapa de ferramentaria', 400);
      }
      this.assertOpen(existing);
      if (!workflowPrerequisitesDone(existing.workflowStages, 'FERRAMENTARIA', existing.requiresTooling, workflowKind(existing))) {
        throw new HttpError(
          'Conclua a etapa PCP de ferramentaria antes de enviar à ferramentaria',
          400,
        );
      }
      if (
        tooling.status !== $Enums.WorkflowStageStatus.READY &&
        tooling.status !== $Enums.WorkflowStageStatus.PENDING
      ) {
        throw new HttpError('A etapa de ferramentaria não está liberada', 400);
      }
      if (tooling.kairoCardIds) {
        throw new HttpError('Ferramentaria já foi enviada ao Kairo', 400);
      }

      const credentials = new KairoCredentialService();
      const client = await credentials.getClientForUser(actingUserId);
      const trimmedTagId = input.tagId?.trim() || undefined;

      const { activity } = await client.createActivity(input.teamId, {
        title: input.title?.trim() || existing.title,
        description:
          input.description?.trim() ||
          [
            `Solicitação: ${existing.trackingCode}`,
            `Título: ${existing.title}`,
            'Etapa: Ferramentaria',
          ].join('\n'),
        integrationSource: KAIRO_INTEGRATION_SOURCE,
        ...(trimmedTagId ? { tagId: trimmedTagId } : {}),
      });

      await credentials.touchValidated(actingUserId);

      const workflowRepo = new WorkflowStagePrismaRepository(tx);
      await workflowRepo.setToolingKairo(id, {
        kairoTeamId: input.teamId,
        kairoCardIds: activity.id,
        kairoSyncedByUserId: actingUserId,
      });

      const refreshed = await solicitationRepo.findById(id);
      if (!refreshed) {
        throw new HttpError('Solicitação não encontrada', 404);
      }
      return refreshed;
    }, { timeout: 30_000 });
  }

  async syncToolingFromKairo(id: string, actingUserId?: string) {
    if (actingUserId) {
      const actor = await this.loadActor(actingUserId);
      if (!canManageToolingStage(actor)) {
        throw new HttpError('Sem permissão para sincronizar ferramentaria', 403);
      }
      const solicitationRepo = new SolicitationPrismaRepository(prisma);
      const existing = await solicitationRepo.findById(id);
      if (!existing || !canAccessSolicitation(actor, existing)) {
        throw new HttpError('Solicitação não encontrada', 404);
      }
    }

    return this.syncToolingForSolicitation(id, actingUserId);
  }

  async syncPendingToolingFromKairo() {
    const workflowRepo = new WorkflowStagePrismaRepository(prisma);
    const pending = await workflowRepo.findPendingToolingKairoSync();
    let updated = 0;

    for (const stage of pending) {
      try {
        const before = stage.status;
        const result = await this.syncToolingForSolicitation(
          stage.solicitationId,
        );
        const after = result.workflowStages.find(
          (item) => item.stage === $Enums.WorkflowStage.FERRAMENTARIA,
        )?.status;
        if (after && after !== before) updated += 1;
      } catch (error) {
        console.error(
          `[workflow-tooling-sync] Falha ao sincronizar ${stage.solicitationId}:`,
          error,
        );
      }
    }

    return { checked: pending.length, updated };
  }

  async sendSampleToKairo(
    id: string,
    input: {
      teamId: string;
      title?: string;
      description?: string;
      tagId?: string;
    },
    actingUserId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Solicitation" WHERE "id" = ${id} FOR UPDATE`;
      const actor = await this.loadActor(actingUserId);
      if (!canManageSampleStage(actor)) {
        throw new HttpError('Sem permissão para enviar amostra ao Kairo', 403);
      }

      const solicitationRepo = new SolicitationPrismaRepository(tx);
      const existing = await solicitationRepo.findById(id);
      if (!existing || !canAccessSolicitation(actor, existing)) {
        throw new HttpError('Solicitação não encontrada', 404);
      }

      const sample = existing.workflowStages.find(
        (stage) => stage.stage === $Enums.WorkflowStage.AMOSTRA,
      );

      if (!sample) {
        throw new HttpError('Esta solicitação não possui etapa de amostra', 400);
      }
      this.assertOpen(existing);
      if (!workflowPrerequisitesDone(existing.workflowStages, 'AMOSTRA', existing.requiresTooling, workflowKind(existing))) {
        throw new HttpError(
          'Conclua Engenharia, PCP, Ferramentaria (quando necessária) e Qualidade · PPAP (quando presente) antes de enviar à amostra',
          400,
        );
      }
      if (
        sample.status !== $Enums.WorkflowStageStatus.READY &&
        sample.status !== $Enums.WorkflowStageStatus.PENDING
      ) {
        throw new HttpError('A etapa de amostra não está liberada', 400);
      }
      if (sample.kairoCardIds) {
        throw new HttpError('Amostra já foi enviada ao Kairo', 400);
      }

      const credentials = new KairoCredentialService();
      const client = await credentials.getClientForUser(actingUserId);
      const trimmedTagId = input.tagId?.trim() || undefined;

      const { activity } = await client.createActivity(input.teamId, {
        title: input.title?.trim() || existing.title,
        description:
          input.description?.trim() ||
          [
            `Solicitação: ${existing.trackingCode}`,
            `Título: ${existing.title}`,
            'Etapa: Amostra',
          ].join('\n'),
        integrationSource: KAIRO_INTEGRATION_SOURCE,
        ...(trimmedTagId ? { tagId: trimmedTagId } : {}),
      });

      await credentials.touchValidated(actingUserId);

      const workflowRepo = new WorkflowStagePrismaRepository(tx);
      await workflowRepo.setSampleKairo(id, {
        kairoTeamId: input.teamId,
        kairoCardIds: activity.id,
        kairoSyncedByUserId: actingUserId,
      });

      const refreshed = await solicitationRepo.findById(id);
      if (!refreshed) {
        throw new HttpError('Solicitação não encontrada', 404);
      }
      return refreshed;
    }, { timeout: 30_000 });
  }

  async syncSampleFromKairo(id: string, actingUserId?: string) {
    if (actingUserId) {
      const actor = await this.loadActor(actingUserId);
      if (!canManageSampleStage(actor)) {
        throw new HttpError('Sem permissão para sincronizar amostra', 403);
      }
      const solicitationRepo = new SolicitationPrismaRepository(prisma);
      const existing = await solicitationRepo.findById(id);
      if (!existing || !canAccessSolicitation(actor, existing)) {
        throw new HttpError('Solicitação não encontrada', 404);
      }
    }

    return this.syncSampleForSolicitation(id, actingUserId);
  }

  async syncPendingSampleFromKairo() {
    const workflowRepo = new WorkflowStagePrismaRepository(prisma);
    const pending = await workflowRepo.findPendingSampleKairoSync();
    let updated = 0;

    for (const stage of pending) {
      try {
        const before = stage.status;
        const result = await this.syncSampleForSolicitation(
          stage.solicitationId,
        );
        const after = result.workflowStages.find(
          (item) => item.stage === $Enums.WorkflowStage.AMOSTRA,
        )?.status;
        if (after && after !== before) updated += 1;
      } catch (error) {
        console.error(
          `[workflow-sample-sync] Falha ao sincronizar ${stage.solicitationId}:`,
          error,
        );
      }
    }

    return { checked: pending.length, updated };
  }

  async updatePcpStage(id: string, stage: PcpStage, action: 'start' | 'finish', userId: string) {
    await this.requirePcpAccess(id, userId);
    await new WorkflowStagePrismaRepository(prisma).transitionPcpStage(
      id, stage, action === 'start' ? 'IN_PROGRESS' : 'DONE', new Date(), userId, true,
    );
    return new SolicitationPrismaRepository(prisma).findById(id);
  }

  async sendPcpToKairo(id: string, stage: PcpStage,
    input: { teamId: string; title?: string; description?: string; tagId?: string }, userId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Solicitation" WHERE "id" = ${id} FOR UPDATE`;
      const existing = await this.requirePcpAccess(id, userId);
      const pcp = existing.workflowStages.find((item) => item.stage === stage);
      if (!pcp || !['READY', 'IN_PROGRESS'].includes(pcp.status)
        || !workflowPrerequisitesDone(existing.workflowStages, stage, existing.requiresTooling, workflowKind(existing))) {
        throw new HttpError('A etapa PCP não está liberada', 400);
      }
      if (pcp.kairoCardIds) throw new HttpError('PCP já foi enviado ao Kairo', 400);
      const credentials = new KairoCredentialService();
      const client = await credentials.getClientForUser(userId);
      const label = stage === 'PCP_FERRAMENTARIA' ? 'PCP · Ferramentaria' : 'PCP · Amostra';
      const { activity } = await client.createActivity(input.teamId, {
        title: input.title?.trim() || `${existing.trackingCode} — ${label}`,
        description: input.description?.trim() || `Solicitação: ${existing.trackingCode}\nTítulo: ${existing.title}\nEtapa: ${label}`,
        integrationSource: KAIRO_INTEGRATION_SOURCE,
        ...(input.tagId?.trim() ? { tagId: input.tagId.trim() } : {}),
      });
      await credentials.touchValidated(userId);
      await new WorkflowStagePrismaRepository(tx).setPcpKairo(id, stage, {
        kairoTeamId: input.teamId, kairoCardIds: activity.id, kairoSyncedByUserId: userId,
      });
      return new SolicitationPrismaRepository(tx).findById(id);
    }, { timeout: 30_000 });
  }

  async syncPcpFromKairo(id: string, stage: PcpStage, userId?: string) {
    const existing = userId ? await this.requirePcpAccess(id, userId)
      : await new SolicitationPrismaRepository(prisma).findById(id);
    if (!existing) throw new HttpError('Solicitação não encontrada', 404);
    const pcp = existing.workflowStages.find((item) => item.stage === stage);
    if (!pcp?.kairoTeamId || !pcp.kairoCardIds || ['DONE', 'CANCELLED', 'REJECTED'].includes(pcp.status)
      || ['COMPLETED', 'CANCELLED', 'DELETED'].includes(existing.status)) return existing;
    if (!workflowPrerequisitesDone(existing.workflowStages, stage, existing.requiresTooling, workflowKind(existing))) return existing;
    const resolved = await this.resolveKairoClient([userId, pcp.kairoSyncedByUserId], userId);
    if (!resolved) return existing;
    const activities: KairoActivity[] = [];
    for (const cardId of splitCommaList(pcp.kairoCardIds)) {
      const { activity } = await resolved.client.getActivity(pcp.kairoTeamId, cardId);
      activities.push(activity);
    }
    if (!activities.length) return existing;
    await new KairoCredentialService().touchValidated(resolved.credentialUserId);
    const repo = new WorkflowStagePrismaRepository(prisma);
    const active = activities.filter((activity) => !activity.deletedAt);
    if (!active.length) await repo.clearPcpKairo(id, stage);
    else if (active.every((activity) => activity.status === 'DONE')) {
      await repo.transitionPcpStage(id, stage, 'DONE', kairoObservedAt(active[0]!, 'finish'),
        pcp.kairoSyncedByUserId ?? resolved.credentialUserId);
    } else {
      const started = active.find((activity) => activity.status && KAIRO_STARTED_STATUSES.has(activity.status));
      if (started) await repo.transitionPcpStage(id, stage, 'IN_PROGRESS', kairoObservedAt(started, 'start'));
    }
    return (await new SolicitationPrismaRepository(prisma).findById(id)) ?? existing;
  }

  async syncPendingPcpFromKairo() {
    const pending = await new WorkflowStagePrismaRepository(prisma).findPendingPcpKairoSync();
    let updated = 0;
    for (const item of pending) {
      try {
        const result = await this.syncPcpFromKairo(item.solicitationId, item.stage as PcpStage);
        if (result.workflowStages.find((stage) => stage.stage === item.stage)?.status !== item.status) updated++;
      } catch (error) {
        console.error(`[workflow-pcp-sync] Falha ao sincronizar ${item.solicitationId}:`, error);
      }
    }
    return { checked: pending.length, updated };
  }

  async updateQualityStage(id: string, action: 'start' | 'finish', userId: string) {
    await this.requireQualityAccess(id, userId);
    await new WorkflowStagePrismaRepository(prisma).transitionQualityStage(
      id, action === 'start' ? 'IN_PROGRESS' : 'DONE', new Date(), userId, true,
    );
    return new SolicitationPrismaRepository(prisma).findById(id);
  }

  async sendQualityToKairo(id: string,
    input: { teamId: string; title?: string; description?: string; tagId?: string }, userId: string) {
    await this.requireQualityAccess(id, userId);
    const credentials = new KairoCredentialService();
    const client = await credentials.getClientForUser(userId);
    // Use the same parent lock as stage transitions to prevent duplicate sends
    // and avoid publishing PPAP after a simultaneous manual completion.
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Solicitation" WHERE "id" = ${id} FOR UPDATE`;
      const existing = await new SolicitationPrismaRepository(tx).findById(id);
      if (!existing) throw new HttpError('Solicitação não encontrada', 404);
      this.assertOpen(existing);
      const quality = existing.workflowStages.find((item) => item.stage === 'QUALIDADE');
      if (!quality || !['READY', 'IN_PROGRESS'].includes(quality.status)) {
        throw new HttpError('A etapa Qualidade · PPAP não está liberada', 400);
      }
      if (quality.kairoCardIds) throw new HttpError('Qualidade · PPAP já foi enviada ao Kairo', 400);
      const label = 'Qualidade · PPAP';
      const { activity } = await client.createActivity(input.teamId, {
        title: input.title?.trim() || `${existing.trackingCode} — ${label}`,
        description: input.description?.trim() || `Solicitação: ${existing.trackingCode}\nTítulo: ${existing.title}\nEtapa: ${label}`,
        integrationSource: KAIRO_INTEGRATION_SOURCE,
        ...(input.tagId?.trim() ? { tagId: input.tagId.trim() } : {}),
      });
      await new WorkflowStagePrismaRepository(tx).setQualityKairo(id, {
        kairoTeamId: input.teamId, kairoCardIds: activity.id, kairoSyncedByUserId: userId,
      });
    }, { timeout: 30_000 });
    await credentials.touchValidated(userId);
    return new SolicitationPrismaRepository(prisma).findById(id);
  }

  async syncQualityFromKairo(id: string, userId?: string) {
    const existing = userId ? await this.requireQualityAccess(id, userId)
      : await new SolicitationPrismaRepository(prisma).findById(id);
    if (!existing) throw new HttpError('Solicitação não encontrada', 404);
    const quality = existing.workflowStages.find((item) => item.stage === 'QUALIDADE');
    if (!quality?.kairoTeamId || !quality.kairoCardIds || ['DONE', 'CANCELLED', 'REJECTED'].includes(quality.status)
      || ['COMPLETED', 'CANCELLED', 'DELETED'].includes(existing.status)) return existing;
    if (!workflowPrerequisitesDone(existing.workflowStages, 'QUALIDADE', existing.requiresTooling, workflowKind(existing))) return existing;
    const resolved = await this.resolveKairoClient([userId, quality.kairoSyncedByUserId], userId);
    if (!resolved) return existing;
    const activities: KairoActivity[] = [];
    for (const cardId of splitCommaList(quality.kairoCardIds)) {
      const { activity } = await resolved.client.getActivity(quality.kairoTeamId, cardId);
      activities.push(activity);
    }
    if (!activities.length) return existing;
    await new KairoCredentialService().touchValidated(resolved.credentialUserId);
    const repo = new WorkflowStagePrismaRepository(prisma);
    const active = activities.filter((activity) => !activity.deletedAt);
    if (!active.length) await repo.clearQualityKairo(id);
    else if (active.every((activity) => activity.status === 'DONE')) {
      await repo.transitionQualityStage(id, 'DONE', kairoObservedAt(active[0]!, 'finish'),
        quality.kairoSyncedByUserId ?? resolved.credentialUserId);
    } else {
      const started = active.find((activity) => activity.status && KAIRO_STARTED_STATUSES.has(activity.status));
      if (started) await repo.transitionQualityStage(id, 'IN_PROGRESS', kairoObservedAt(started, 'start'));
    }
    return (await new SolicitationPrismaRepository(prisma).findById(id)) ?? existing;
  }

  async syncPendingQualityFromKairo() {
    const pending = await new WorkflowStagePrismaRepository(prisma).findPendingQualityKairoSync();
    let updated = 0;
    for (const item of pending) {
      try {
        const result = await this.syncQualityFromKairo(item.solicitationId);
        if (result.workflowStages.find((stage) => stage.stage === item.stage)?.status !== item.status) updated++;
      } catch (error) {
        console.error(`[workflow-quality-sync] Falha ao sincronizar ${item.solicitationId}:`, error);
      }
    }
    return { checked: pending.length, updated };
  }

  private assertOpen(solicitation: SolicitationWithWorkflow) {
    if (['COMPLETED', 'CANCELLED', 'DELETED'].includes(solicitation.status)) {
      throw new HttpError('Solicitação encerrada não pode avançar no workflow', 400);
    }
  }

  private async requirePcpAccess(id: string, userId: string) {
    const actor = await this.loadActor(userId);
    if (!canManagePcpStage(actor)) throw new HttpError('Sem permissão para gerenciar PCP', 403);
    const existing = await new SolicitationPrismaRepository(prisma).findById(id);
    if (!existing || !canAccessSolicitation(actor, existing)) throw new HttpError('Solicitação não encontrada', 404);
    this.assertOpen(existing);
    return existing;
  }

  private async requireQualityAccess(id: string, userId: string) {
    const actor = await this.loadActor(userId);
    if (!canManageQualityStage(actor)) throw new HttpError('Sem permissão para gerenciar Qualidade · PPAP', 403);
    const existing = await new SolicitationPrismaRepository(prisma).findById(id);
    if (!existing || !canAccessSolicitation(actor, existing)) throw new HttpError('Solicitação não encontrada', 404);
    this.assertOpen(existing);
    return existing;
  }

  async declineStage(id: string, stage: $Enums.WorkflowStage, reason: string, userId: string) {
    const actor = await this.loadActor(userId);
    if (!canDeclineWorkflowStage(actor, stage)) throw new HttpError('Sem permissão para recusar esta etapa', 403);
    const repository = new SolicitationPrismaRepository(prisma);
    const existing = await repository.findById(id);
    if (!existing || !canAccessSolicitation(actor, existing)) throw new HttpError('Solicitação não encontrada', 404);
    this.assertOpen(existing);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
    await new WorkflowStagePrismaRepository(prisma).declineStage(id, stage, reason, userId, user.name);
    const warnings: string[] = [];
    const declined = (await repository.findById(id))!;
    const selected = declined.workflowStages.find((item) => item.stage === stage)!;
    const engineering = stage === 'ENGENHARIA';
    const teamId = engineering ? declined.kairoTeamId : selected.kairoTeamId;
    const ids = [...new Set(splitCommaList(engineering ? declined.kairoCardIds || declined.kairoCardId : selected.kairoCardIds))];
    if (teamId && ids.length) {
      try {
        const resolved = await this.resolveKairoClient([userId, engineering ? declined.kairoSyncedByUserId : selected.kairoSyncedByUserId]);
        if (!resolved) throw new Error('Kairo credentials unavailable');
        for (const cardId of ids) {
          try {
            if (engineering && declined.kind === 'PROJETO') await resolved.client.cancelProject(teamId, cardId);
            else await resolved.client.cancelActivity(teamId, cardId);
          } catch (error) {
            console.error(`[workflow-kairo-cancel] Falha ao cancelar card ${cardId}:`, error);
            warnings.push(`Etapa recusada. Não foi possível cancelar o card ${cardId} no Kairo.`);
          }
        }
      } catch {
        warnings.push(`Etapa recusada. Kairo indisponível: cards ${ids.join(', ')} permanecem sem alteração.`);
      }
    }
    return { solicitation: (await repository.findById(id))!, warnings };
  }

  async cancelOpenStages(solicitationId: string) {
    const workflowRepo = new WorkflowStagePrismaRepository(prisma);
    return workflowRepo.cancelOpenStages(solicitationId);
  }

  async summary(actor: AccessActor) {
    const workflowRepo = new WorkflowStagePrismaRepository(prisma);
    const rows = await workflowRepo.summary(solicitationScope(actor));
    const stages = visibleWorkflowStages(actor);

    return {
      stages: stages.map((stage) => {
        const stageRows = rows.filter((row) => row.stage === stage);
        const total = stageRows.reduce((sum, row) => sum + row.count, 0);
        const inProgress =
          stageRows.find(
            (row) => row.status === $Enums.WorkflowStageStatus.IN_PROGRESS,
          )?.count ?? 0;
        const waiting =
          (stageRows.find(
            (row) => row.status === $Enums.WorkflowStageStatus.READY,
          )?.count ?? 0) +
          (stageRows.find(
            (row) => row.status === $Enums.WorkflowStageStatus.PENDING,
          )?.count ?? 0);
        const done =
          stageRows.find((row) => row.status === $Enums.WorkflowStageStatus.DONE)
            ?.count ?? 0;

        const rejected = stageRows.find((row) => row.status === 'REJECTED')?.count ?? 0;
        return { stage, total, inProgress, waiting, done, rejected };
      }),
    };
  }

  private async syncToolingForSolicitation(
    id: string,
    actingUserId?: string,
  ): Promise<SolicitationWithWorkflow> {
    const solicitationRepo = new SolicitationPrismaRepository(prisma);
    const existing = await solicitationRepo.findById(id);
    if (!existing) {
      throw new HttpError('Solicitação não encontrada', 404);
    }

    const tooling = existing.workflowStages.find(
      (stage) => stage.stage === $Enums.WorkflowStage.FERRAMENTARIA,
    );
    if (['COMPLETED', 'CANCELLED', 'DELETED'].includes(existing.status)
      || !workflowPrerequisitesDone(existing.workflowStages, 'FERRAMENTARIA', existing.requiresTooling, workflowKind(existing))
      || tooling?.status === 'DONE' || tooling?.status === 'CANCELLED' || tooling?.status === 'REJECTED') return existing;
    if (!tooling?.kairoTeamId || !tooling.kairoCardIds) {
      return existing;
    }

    const cardIds = splitCommaList(tooling.kairoCardIds);
    if (cardIds.length === 0) return existing;

    const resolved = await this.resolveKairoClient(
      [actingUserId, tooling.kairoSyncedByUserId],
      actingUserId,
    );
    if (!resolved) return existing;

    const activities: KairoActivity[] = [];
    for (const cardId of cardIds) {
      const { activity } = await resolved.client.getActivity(
        tooling.kairoTeamId,
        cardId,
      );
      activities.push(activity);
    }

    await new KairoCredentialService().touchValidated(resolved.credentialUserId);

    const workflowRepo = new WorkflowStagePrismaRepository(prisma);

    if (activities.every((activity) => activity.deletedAt)) {
      await workflowRepo.clearToolingKairo(id);
      const refreshed = await solicitationRepo.findById(id);
      return refreshed ?? existing;
    }

    const active = activities.filter((activity) => !activity.deletedAt);
    if (active.length === 0) return existing;

    if (active.every((activity) => activity.status === 'DONE')) {
      await workflowRepo.markToolingFinished(
        id,
        kairoObservedAt(active[0]!, 'finish'),
      );
      const refreshed = await solicitationRepo.findById(id);
      return refreshed ?? existing;
    }

    if (
      (tooling.status === $Enums.WorkflowStageStatus.READY ||
        tooling.status === $Enums.WorkflowStageStatus.PENDING) &&
      active.some(
        (activity) =>
          activity.status && KAIRO_STARTED_STATUSES.has(activity.status),
      )
    ) {
      const started = active.find(
        (activity) =>
          activity.status && KAIRO_STARTED_STATUSES.has(activity.status),
      )!;
      await workflowRepo.markToolingStarted(
        id,
        kairoObservedAt(started, 'start'),
      );
      const refreshed = await solicitationRepo.findById(id);
      return refreshed ?? existing;
    }

    return existing;
  }

  private async syncSampleForSolicitation(
    id: string,
    actingUserId?: string,
  ): Promise<SolicitationWithWorkflow> {
    const solicitationRepo = new SolicitationPrismaRepository(prisma);
    const existing = await solicitationRepo.findById(id);
    if (!existing) {
      throw new HttpError('Solicitação não encontrada', 404);
    }

    const sample = existing.workflowStages.find(
      (stage) => stage.stage === $Enums.WorkflowStage.AMOSTRA,
    );
    if (['COMPLETED', 'CANCELLED', 'DELETED'].includes(existing.status)
      || !workflowPrerequisitesDone(existing.workflowStages, 'AMOSTRA', existing.requiresTooling, workflowKind(existing))
      || sample?.status === 'CANCELLED' || sample?.status === 'REJECTED') return existing;
    if (!sample?.kairoTeamId || !sample.kairoCardIds) {
      return existing;
    }

    const cardIds = splitCommaList(sample.kairoCardIds);
    if (cardIds.length === 0) return existing;

    const resolved = await this.resolveKairoClient(
      [actingUserId, sample.kairoSyncedByUserId],
      actingUserId,
    );
    if (!resolved) return existing;

    const activities: KairoActivity[] = [];
    for (const cardId of cardIds) {
      const { activity } = await resolved.client.getActivity(
        sample.kairoTeamId,
        cardId,
      );
      activities.push(activity);
    }

    await new KairoCredentialService().touchValidated(resolved.credentialUserId);

    const workflowRepo = new WorkflowStagePrismaRepository(prisma);

    if (activities.every((activity) => activity.deletedAt)) {
      await workflowRepo.clearSampleKairo(id);
      const refreshed = await solicitationRepo.findById(id);
      return refreshed ?? existing;
    }

    const active = activities.filter((activity) => !activity.deletedAt);
    if (active.length === 0) return existing;

    if (active.every((activity) => activity.status === 'DONE')) {
      const finishedAt = kairoObservedAt(active[0]!, 'finish');
      await workflowRepo.markSampleFinished(
        id,
        finishedAt,
        sample.kairoSyncedByUserId ?? resolved.credentialUserId,
      );

      const refreshed = await solicitationRepo.findById(id);
      return refreshed ?? existing;
    }

    if (
      (sample.status === $Enums.WorkflowStageStatus.READY ||
        sample.status === $Enums.WorkflowStageStatus.PENDING) &&
      active.some(
        (activity) =>
          activity.status && KAIRO_STARTED_STATUSES.has(activity.status),
      )
    ) {
      const started = active.find(
        (activity) =>
          activity.status && KAIRO_STARTED_STATUSES.has(activity.status),
      )!;
      await workflowRepo.markSampleStarted(
        id,
        kairoObservedAt(started, 'start'),
      );
      const refreshed = await solicitationRepo.findById(id);
      return refreshed ?? existing;
    }

    return existing;
  }

  private async resolveKairoClient(
    candidateUserIds: Array<string | null | undefined>,
    actingUserId?: string,
  ) {
    const credentials = new KairoCredentialService();
    const ids = candidateUserIds.filter((value): value is string =>
      Boolean(value),
    );

    for (const userId of ids) {
      const client = await credentials.tryGetClientForUser(userId);
      if (client) {
        return { client, credentialUserId: userId };
      }
    }

    if (actingUserId) {
      throw new HttpError(
        'Vincule sua chave de API do Kairo em Integrações antes de sincronizar',
        400,
      );
    }
    return null;
  }

  private async loadActor(userId: string): Promise<AccessActor> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        department: true,
        cardNumber: true,
        unit: true,
      },
    });
    if (!user) {
      throw new HttpError('Não autorizado', 401);
    }
    return user;
  }
}
