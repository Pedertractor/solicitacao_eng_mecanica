import {
  $Enums,
  Prisma,
  PrismaClient,
  type SolicitationWorkflowStage,
} from '../../generated/prisma/client.js';

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

  async markEngineeringStarted(
    solicitationId: string,
    startedAt: Date,
  ): Promise<SolicitationWorkflowStage[]> {
    await this.prisma.solicitationWorkflowStage.updateMany({
      where: {
        solicitationId,
        stage: $Enums.WorkflowStage.ENGENHARIA,
        status: $Enums.WorkflowStageStatus.PENDING,
      },
      data: {
        status: $Enums.WorkflowStageStatus.IN_PROGRESS,
        actualStartAt: startedAt,
      },
    });
    return this.findBySolicitationId(solicitationId);
  }

  async markEngineeringFinished(
    solicitationId: string,
    finishedAt: Date,
  ): Promise<SolicitationWorkflowStage[]> {
    const engineering = await this.findStage(
      solicitationId,
      $Enums.WorkflowStage.ENGENHARIA,
    );
    if (!engineering || engineering.status === $Enums.WorkflowStageStatus.DONE) {
      return this.findBySolicitationId(solicitationId);
    }

    await this.prisma.solicitationWorkflowStage.update({
      where: { id: engineering.id },
      data: {
        status: $Enums.WorkflowStageStatus.DONE,
        actualStartAt: engineering.actualStartAt ?? finishedAt,
        actualEndAt: finishedAt,
      },
    });

    const tooling = await this.findStage(
      solicitationId,
      $Enums.WorkflowStage.FERRAMENTARIA,
    );
    if (tooling && tooling.status === $Enums.WorkflowStageStatus.PENDING) {
      await this.prisma.solicitationWorkflowStage.update({
        where: { id: tooling.id },
        data: { status: $Enums.WorkflowStageStatus.READY },
      });
    } else {
      const sample = await this.findStage(
        solicitationId,
        $Enums.WorkflowStage.AMOSTRA,
      );
      if (sample && sample.status === $Enums.WorkflowStageStatus.PENDING) {
        await this.prisma.solicitationWorkflowStage.update({
          where: { id: sample.id },
          data: { status: $Enums.WorkflowStageStatus.READY },
        });
      }
    }

    return this.findBySolicitationId(solicitationId);
  }

  async markToolingStarted(
    solicitationId: string,
    startedAt: Date,
  ): Promise<SolicitationWorkflowStage[]> {
    await this.prisma.solicitationWorkflowStage.updateMany({
      where: {
        solicitationId,
        stage: $Enums.WorkflowStage.FERRAMENTARIA,
        status: {
          in: [
            $Enums.WorkflowStageStatus.READY,
            $Enums.WorkflowStageStatus.PENDING,
          ],
        },
      },
      data: {
        status: $Enums.WorkflowStageStatus.IN_PROGRESS,
        actualStartAt: startedAt,
      },
    });
    return this.findBySolicitationId(solicitationId);
  }

  async markToolingFinished(
    solicitationId: string,
    finishedAt: Date,
  ): Promise<SolicitationWorkflowStage[]> {
    const tooling = await this.findStage(
      solicitationId,
      $Enums.WorkflowStage.FERRAMENTARIA,
    );
    if (!tooling || tooling.status === $Enums.WorkflowStageStatus.DONE) {
      return this.findBySolicitationId(solicitationId);
    }

    await this.prisma.solicitationWorkflowStage.update({
      where: { id: tooling.id },
      data: {
        status: $Enums.WorkflowStageStatus.DONE,
        actualStartAt: tooling.actualStartAt ?? finishedAt,
        actualEndAt: finishedAt,
      },
    });

    const sample = await this.findStage(
      solicitationId,
      $Enums.WorkflowStage.AMOSTRA,
    );
    if (sample && sample.status === $Enums.WorkflowStageStatus.PENDING) {
      await this.prisma.solicitationWorkflowStage.update({
        where: { id: sample.id },
        data: { status: $Enums.WorkflowStageStatus.READY },
      });
    }

    return this.findBySolicitationId(solicitationId);
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

  async clearToolingKairo(
    solicitationId: string,
  ): Promise<SolicitationWorkflowStage> {
    return this.prisma.solicitationWorkflowStage.update({
      where: {
        solicitationId_stage: {
          solicitationId,
          stage: $Enums.WorkflowStage.FERRAMENTARIA,
        },
      },
      data: {
        kairoTeamId: null,
        kairoCardIds: null,
        kairoSyncedAt: null,
        kairoSyncedByUserId: null,
        status: $Enums.WorkflowStageStatus.READY,
        actualStartAt: null,
        actualEndAt: null,
      },
    });
  }

  async markSampleStarted(
    solicitationId: string,
    startedAt: Date,
    completedByUserId?: string,
  ): Promise<SolicitationWorkflowStage[]> {
    await this.prisma.solicitationWorkflowStage.updateMany({
      where: {
        solicitationId,
        stage: $Enums.WorkflowStage.AMOSTRA,
        status: {
          in: [
            $Enums.WorkflowStageStatus.READY,
            $Enums.WorkflowStageStatus.PENDING,
          ],
        },
      },
      data: {
        status: $Enums.WorkflowStageStatus.IN_PROGRESS,
        actualStartAt: startedAt,
        ...(completedByUserId ? { completedByUserId } : {}),
      },
    });
    return this.findBySolicitationId(solicitationId);
  }

  async markSampleFinished(
    solicitationId: string,
    finishedAt: Date,
    completedByUserId?: string,
  ): Promise<SolicitationWorkflowStage[]> {
    const sample = await this.findStage(
      solicitationId,
      $Enums.WorkflowStage.AMOSTRA,
    );
    if (!sample || sample.status === $Enums.WorkflowStageStatus.DONE) {
      return this.findBySolicitationId(solicitationId);
    }

    await this.prisma.solicitationWorkflowStage.update({
      where: { id: sample.id },
      data: {
        status: $Enums.WorkflowStageStatus.DONE,
        actualStartAt: sample.actualStartAt ?? finishedAt,
        actualEndAt: finishedAt,
        ...(completedByUserId
          ? { completedByUserId }
          : sample.kairoSyncedByUserId
            ? { completedByUserId: sample.kairoSyncedByUserId }
            : {}),
      },
    });

    return this.findBySolicitationId(solicitationId);
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

  async clearSampleKairo(
    solicitationId: string,
  ): Promise<SolicitationWorkflowStage> {
    return this.prisma.solicitationWorkflowStage.update({
      where: {
        solicitationId_stage: {
          solicitationId,
          stage: $Enums.WorkflowStage.AMOSTRA,
        },
      },
      data: {
        kairoTeamId: null,
        kairoCardIds: null,
        kairoSyncedAt: null,
        kairoSyncedByUserId: null,
        status: $Enums.WorkflowStageStatus.READY,
        actualStartAt: null,
        actualEndAt: null,
      },
    });
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
