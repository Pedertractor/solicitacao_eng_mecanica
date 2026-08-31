import { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import { P5AuditPrismaRepository } from '../repositories/prisma/p5-audit-repository.js';
import { isAuditLogVisible } from './p5-audit-scope.js';
import type { ScopedPillarCodes } from './pillar-scope-service.js';
import type {
  ExternalActorSnapshot,
  PreviousNature,
  SafetyAccidentSnapshot,
} from './safety-accident-state.js';

export class P5AuditService {
  constructor(private client: PrismaClient | Prisma.TransactionClient = prisma) {}

  async log(input: {
    userId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    cycleId?: string | null;
    before?: Prisma.InputJsonValue | null;
    after?: Prisma.InputJsonValue | null;
    metadata?: Prisma.InputJsonValue | null;
  }) {
    const repo = new P5AuditPrismaRepository(this.client);
    return repo.create(input);
  }

  async logAccidentChange(input: {
    action: string;
    accidentId?: string | null;
    externalId: string;
    cycleId?: string | null;
    before?: SafetyAccidentSnapshot | null;
    after?: SafetyAccidentSnapshot | null;
    actor: ExternalActorSnapshot;
    sourceChangedAt: Date;
    previousNature?: PreviousNature;
    nature?: 'ACT' | 'CONDITION';
    changedFields?: string[];
    previousCycleId?: string | null;
    reason?: string | null;
    actorType?: 'CIPA_USER' | 'SYSTEM';
    channel?: string;
  }) {
    const receivedAt = new Date().toISOString();
    return this.log({
      userId: null,
      action: input.action,
      entityType: input.accidentId ? 'SafetyAccident' : 'CipaAccidentMutation',
      entityId: input.accidentId ?? input.externalId,
      cycleId: input.cycleId ?? null,
      before: (input.before ?? null) as unknown as Prisma.InputJsonValue,
      after: (input.after ?? null) as unknown as Prisma.InputJsonValue,
      metadata: {
        actorType: input.actorType ?? 'CIPA_USER',
        actor: input.actor,
        externalId: input.externalId,
        sourceChangedAt: input.sourceChangedAt.toISOString(),
        receivedAt,
        previousNature: input.previousNature ?? null,
        nature: input.nature ?? null,
        changedFields: input.changedFields ?? [],
        previousCycleId: input.previousCycleId ?? null,
        reason: input.reason ?? null,
        channel: input.channel ?? 'CIPA_API',
        pillarCode: 'SAFETY',
      },
    });
  }

  async listByCycle(cycleId: string, allowedPillarCodes?: ScopedPillarCodes) {
    const repo = new P5AuditPrismaRepository(this.client);
    const logs = await repo.findByCycleId(cycleId);
    if (allowedPillarCodes === undefined) return logs;
    return logs.filter((log) =>
      isAuditLogVisible(
        {
          action: log.action,
          entityType: log.entityType,
          metadata: log.metadata,
        },
        allowedPillarCodes,
      ),
    );
  }

  async listSafetyHistoryByCycle(
    cycleId: string,
    options?: {
      page?: number;
      pageSize?: number;
      externalId?: string;
      action?: string;
    },
  ) {
    const repo = new P5AuditPrismaRepository(this.client);
    return repo.findSafetyHistoryByCycleId(cycleId, options);
  }
}
