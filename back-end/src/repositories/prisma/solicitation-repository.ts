import {
  $Enums,
  Prisma,
  PrismaClient,
  type Solicitation,
  type SolicitationWorkflowStage,
} from '../../generated/prisma/client.js';
import { generateTrackingCode } from '../../lib/tracking-code.js';

const CREATE_MAX_ATTEMPTS = 5;

export const workflowStagesInclude = {
  workflowStages: {
    orderBy: { order: 'asc' as const },
  },
} satisfies Prisma.SolicitationInclude;

export type SolicitationWithWorkflow = Solicitation & {
  workflowStages: SolicitationWorkflowStage[];
};

export class SolicitationPrismaRepository {
  constructor(private prisma: PrismaClient | Prisma.TransactionClient) {}

  async create(data: {
    employeeId: string;
    requesterName: string;
    requesterEmail: string;
    cardNumber: string;
    unit: $Enums.Unit;
    costCenter: string;
    sectorId: string;
    sectorName: string;
    pillarOrLocation: string;
    title: string;
    description: string;
    department?: $Enums.UserDepartment;
    client?: $Enums.SolicitationClient | null;
    processInstructionRequester?: string | null;
    processInstructionProcess?: string | null;
    processInstructionType?: string | null;
    processInstructionDeadlineLabel?: string | null;
    processInstructionDeadlineDate?: string | null;
    deliveryDate?: Date | null;
    partNumbers?: string | null;
    fileLink?: string | null;
    requiresTooling?: boolean;
  }): Promise<SolicitationWithWorkflow> {
    let lastError: unknown;

    for (let attempt = 0; attempt < CREATE_MAX_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.solicitation.create({
          data: {
            ...data,
            trackingCode: generateTrackingCode(),
          },
          include: workflowStagesInclude,
        });
      } catch (error) {
        lastError = error;
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }

  async findManyPaginated(input: {
    status?: $Enums.SolicitationStatus;
    page: number;
    pageSize: number;
    sortBy?:
      | 'createdAt'
      | 'requesterName'
      | 'sectorName'
      | 'title'
      | 'status';
    sortOrder?: 'asc' | 'desc';
    scope?: Prisma.SolicitationWhereInput;
    onlyWorkflow?: boolean;
    createdFrom?: Date;
    createdTo?: Date;
    search?: string;
  }): Promise<{ items: SolicitationWithWorkflow[]; total: number }> {
    const statusWhere = input.status
      ? { status: input.status }
      : { status: { not: $Enums.SolicitationStatus.DELETED } };
    const workflowWhere: Prisma.SolicitationWhereInput = input.onlyWorkflow
      ? { workflowStages: { some: {} } }
      : {};
    const dateWhere: Prisma.SolicitationWhereInput =
      input.createdFrom || input.createdTo
        ? {
            createdAt: {
              ...(input.createdFrom ? { gte: input.createdFrom } : {}),
              ...(input.createdTo ? { lte: input.createdTo } : {}),
            },
          }
        : {};
    const term = input.search?.trim();
    const searchWhere: Prisma.SolicitationWhereInput = term
      ? {
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { requesterName: { contains: term, mode: 'insensitive' } },
            { trackingCode: { contains: term, mode: 'insensitive' } },
            { sectorName: { contains: term, mode: 'insensitive' } },
            { cardNumber: { contains: term, mode: 'insensitive' } },
          ],
        }
      : {};
    const where: Prisma.SolicitationWhereInput = {
      AND: [
        statusWhere,
        workflowWhere,
        dateWhere,
        searchWhere,
        input.scope ?? {},
      ],
    };
    const skip = (input.page - 1) * input.pageSize;
    const sortBy = input.sortBy ?? 'createdAt';
    const sortOrder = input.sortOrder ?? 'desc';

    const [items, total] = await Promise.all([
      this.prisma.solicitation.findMany({
        where,
        include: workflowStagesInclude,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: input.pageSize,
      }),
      this.prisma.solicitation.count({ where }),
    ]);

    return { items, total };
  }

  async findOpenEngineeringQueue(
    scope: Prisma.SolicitationWhereInput,
    limit: number,
  ): Promise<SolicitationWithWorkflow[]> {
    const stages = await this.prisma.solicitationWorkflowStage.findMany({
      where: {
        stage: $Enums.WorkflowStage.ENGENHARIA,
        status: {
          in: [
            $Enums.WorkflowStageStatus.PENDING,
            $Enums.WorkflowStageStatus.READY,
            $Enums.WorkflowStageStatus.IN_PROGRESS,
          ],
        },
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
            scope,
          ],
        },
      },
      orderBy: [
        { plannedEndAt: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
      take: limit,
      include: { solicitation: { include: workflowStagesInclude } },
    });

    return stages.map((stage) => stage.solicitation);
  }

  async findById(id: string): Promise<SolicitationWithWorkflow | null> {
    return await this.prisma.solicitation.findUnique({
      where: { id },
      include: workflowStagesInclude,
    });
  }

  async findByTrackingCode(
    trackingCode: string,
  ): Promise<SolicitationWithWorkflow | null> {
    return await this.prisma.solicitation.findUnique({
      where: { trackingCode },
      include: workflowStagesInclude,
    });
  }

  async findLatestRequesterEmail(
    cardNumber: string,
    unit: $Enums.Unit,
  ): Promise<string | null> {
    const row = await this.prisma.solicitation.findFirst({
      where: {
        cardNumber,
        unit,
        requesterEmail: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: { requesterEmail: true },
    });
    return row?.requesterEmail ?? null;
  }

  async updateStatus(
    id: string,
    status: $Enums.SolicitationStatus,
    statusUpdatedByUserId: string,
  ): Promise<SolicitationWithWorkflow> {
    return await this.prisma.solicitation.update({
      where: { id },
      data: {
        status,
        statusUpdatedAt: new Date(),
        statusUpdatedByUserId,
      },
      include: workflowStagesInclude,
    });
  }

  async updateReview(
    id: string,
    data: {
      kind?: $Enums.SolicitationKind | null;
      client: $Enums.SolicitationClient | null;
      activityType: $Enums.SolicitationActivityType | null;
      productType: $Enums.SolicitationProductType | null;
      priority: $Enums.SolicitationPriority | null;
      status?: $Enums.SolicitationStatus;
      statusUpdatedByUserId?: string;
    },
  ): Promise<SolicitationWithWorkflow> {
    const { status, statusUpdatedByUserId, kind, ...reviewFields } = data;
    return await this.prisma.solicitation.update({
      where: { id },
      data: {
        ...reviewFields,
        ...(kind !== undefined ? { kind } : {}),
        ...(status
          ? {
              status,
              statusUpdatedAt: new Date(),
              statusUpdatedByUserId,
            }
          : {}),
      },
      include: workflowStagesInclude,
    });
  }

  async updateKind(
    id: string,
    kind: $Enums.SolicitationKind,
  ): Promise<SolicitationWithWorkflow> {
    return await this.prisma.solicitation.update({
      where: { id },
      data: { kind },
      include: workflowStagesInclude,
    });
  }

  async updateOfNumber(
    id: string,
    ofNumber: string | null,
  ): Promise<SolicitationWithWorkflow> {
    return await this.prisma.solicitation.update({
      where: { id },
      data: { ofNumber },
      include: workflowStagesInclude,
    });
  }

  async markKairoSynced(
    id: string,
    data: {
      kairoCardId: string;
      kairoCardIds?: string | null;
      kairoTeamId: string;
      kairoSyncedByUserId: string;
      kind: $Enums.SolicitationKind;
    },
  ): Promise<SolicitationWithWorkflow> {
    return await this.prisma.solicitation.update({
      where: { id },
      data: {
        kind: data.kind,
        kairoCardId: data.kairoCardId,
        kairoCardIds: data.kairoCardIds ?? data.kairoCardId,
        kairoTeamId: data.kairoTeamId,
        kairoSyncedAt: new Date(),
        kairoSyncedByUserId: data.kairoSyncedByUserId,
      },
      include: workflowStagesInclude,
    });
  }

  async markDeleted(
    id: string,
    data: {
      deletedByUserId?: string | null;
      deletedByName: string;
      deletedFrom: $Enums.SolicitationDeletionSource;
    },
  ): Promise<SolicitationWithWorkflow> {
    return await this.prisma.solicitation.update({
      where: { id },
      data: {
        status: $Enums.SolicitationStatus.DELETED,
        deletedAt: new Date(),
        deletedByUserId: data.deletedByUserId ?? null,
        deletedByName: data.deletedByName,
        deletedFrom: data.deletedFrom,
        statusUpdatedAt: new Date(),
        ...(data.deletedByUserId
          ? { statusUpdatedByUserId: data.deletedByUserId }
          : {}),
      },
      include: workflowStagesInclude,
    });
  }

  async findPendingKairoSync(
    department?: $Enums.UserDepartment,
  ): Promise<SolicitationWithWorkflow[]> {
    return await this.prisma.solicitation.findMany({
      where: {
        ...(department ? { department } : {}),
        kairoTeamId: { not: null },
        OR: [
          { kairoCardId: { not: null } },
          { kairoCardIds: { not: null } },
        ],
        status: {
          notIn: [
            $Enums.SolicitationStatus.COMPLETED,
            $Enums.SolicitationStatus.CANCELLED,
            $Enums.SolicitationStatus.DELETED,
          ],
        },
        NOT: {
          workflowStages: {
            some: {
              stage: $Enums.WorkflowStage.ENGENHARIA,
              status: $Enums.WorkflowStageStatus.DONE,
            },
          },
        },
      },
      include: workflowStagesInclude,
      orderBy: { updatedAt: 'asc' },
    });
  }

  async findProcessChartRows(input: {
    teamId: string;
    start: Date;
    end: Date;
  }) {
    return await this.prisma.solicitation.findMany({
      where: {
        department: $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS,
        kairoTeamId: input.teamId,
        deletedAt: null,
        status: { not: $Enums.SolicitationStatus.DELETED },
        createdAt: { gte: input.start, lt: input.end },
      },
      select: {
        client: true,
        processInstructionType: true,
        requesterName: true,
      },
    });
  }
}

