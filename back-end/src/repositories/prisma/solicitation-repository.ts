import {
  $Enums,
  Prisma,
  PrismaClient,
  type Solicitation,
} from '../../generated/prisma/client.js';
import { generateTrackingCode } from '../../lib/tracking-code.js';

const CREATE_MAX_ATTEMPTS = 5;

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
  }): Promise<Solicitation> {
    let lastError: unknown;

    for (let attempt = 0; attempt < CREATE_MAX_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.solicitation.create({
          data: {
            ...data,
            trackingCode: generateTrackingCode(),
          },
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
  }): Promise<{ items: Solicitation[]; total: number }> {
    const where = input.status ? { status: input.status } : {};
    const skip = (input.page - 1) * input.pageSize;
    const sortBy = input.sortBy ?? 'createdAt';
    const sortOrder = input.sortOrder ?? 'desc';

    const [items, total] = await Promise.all([
      this.prisma.solicitation.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: input.pageSize,
      }),
      this.prisma.solicitation.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: string): Promise<Solicitation | null> {
    return await this.prisma.solicitation.findUnique({ where: { id } });
  }

  async findByTrackingCode(trackingCode: string): Promise<Solicitation | null> {
    return await this.prisma.solicitation.findUnique({
      where: { trackingCode },
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
  ): Promise<Solicitation> {
    return await this.prisma.solicitation.update({
      where: { id },
      data: {
        status,
        statusUpdatedAt: new Date(),
        statusUpdatedByUserId,
      },
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
  ): Promise<Solicitation> {
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
    });
  }

  async updateKind(
    id: string,
    kind: $Enums.SolicitationKind,
  ): Promise<Solicitation> {
    return await this.prisma.solicitation.update({
      where: { id },
      data: { kind },
    });
  }

  async markKairoSynced(
    id: string,
    data: {
      kairoCardId: string;
      kairoTeamId: string;
      kairoSyncedByUserId: string;
      kind: $Enums.SolicitationKind;
    },
  ): Promise<Solicitation> {
    return await this.prisma.solicitation.update({
      where: { id },
      data: {
        kind: data.kind,
        kairoCardId: data.kairoCardId,
        kairoTeamId: data.kairoTeamId,
        kairoSyncedAt: new Date(),
        kairoSyncedByUserId: data.kairoSyncedByUserId,
      },
    });
  }

  async markDeleted(
    id: string,
    data: {
      deletedByUserId?: string | null;
      deletedByName: string;
      deletedFrom: $Enums.SolicitationDeletionSource;
    },
  ): Promise<Solicitation> {
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
    });
  }

  async findPendingKairoSync(): Promise<Solicitation[]> {
    return await this.prisma.solicitation.findMany({
      where: {
        kairoCardId: { not: null },
        kairoTeamId: { not: null },
        status: {
          notIn: [
            $Enums.SolicitationStatus.COMPLETED,
            $Enums.SolicitationStatus.CANCELLED,
            $Enums.SolicitationStatus.DELETED,
          ],
        },
      },
      orderBy: { updatedAt: 'asc' },
    });
  }
}

