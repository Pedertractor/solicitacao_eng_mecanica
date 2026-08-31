import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { CIPA_ACCIDENT_AUDIT_ACTIONS } from '../../services/safety-accident-state.js';

export class P5AuditPrismaRepository {
  constructor(private prisma: PrismaClient | Prisma.TransactionClient) {}

  async create(data: {
    userId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    cycleId?: string | null;
    before?: Prisma.InputJsonValue | null;
    after?: Prisma.InputJsonValue | null;
    metadata?: Prisma.InputJsonValue | null;
  }) {
    return this.prisma.p5AuditLog.create({
      data: {
        userId: data.userId ?? null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        cycleId: data.cycleId ?? null,
        before: data.before ?? Prisma.JsonNull,
        after: data.after ?? Prisma.JsonNull,
        metadata: data.metadata ?? Prisma.JsonNull,
      },
    });
  }

  async findByCycleId(cycleId: string) {
    return this.prisma.p5AuditLog.findMany({
      where: { cycleId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findSafetyHistoryByCycleId(
    cycleId: string,
    options?: {
      page?: number;
      pageSize?: number;
      externalId?: string;
      action?: string;
    },
  ) {
    const page = options?.page ?? 1;
    const pageSize = Math.min(options?.pageSize ?? 10, 10);
    const skip = (page - 1) * pageSize;
    const externalId = options?.externalId?.trim();

    const where: Prisma.P5AuditLogWhereInput = {
      action: options?.action
        ? options.action
        : { in: [...CIPA_ACCIDENT_AUDIT_ACTIONS] },
      AND: [
        {
          OR: [
            { cycleId },
            {
              metadata: {
                path: ['previousCycleId'],
                equals: cycleId,
              },
            },
          ],
        },
        ...(externalId
          ? [
              {
                OR: [
                  { entityId: { contains: externalId } },
                  {
                    metadata: {
                      path: ['externalId'],
                      equals: externalId,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };

    const [items, totalItems] = await Promise.all([
      this.prisma.p5AuditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.p5AuditLog.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      },
    };
  }
}
