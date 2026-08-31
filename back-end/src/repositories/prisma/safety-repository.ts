import {
  $Enums,
  Prisma,
  PrismaClient,
} from '../../generated/prisma/client.js';
import { isRealAccidentCount } from '../../services/safety-accident-state.js';

const SCOREABLE_TYPES: $Enums.AccidentType[] = [
  $Enums.AccidentType.WITH_LEAVE,
  $Enums.AccidentType.WITHOUT_LEAVE,
];

export class SafetyAccidentPrismaRepository {
  constructor(private prisma: PrismaClient | Prisma.TransactionClient) {}

  async findCipaByExternalId(externalId: string) {
    return this.prisma.safetyAccident.findUnique({
      where: {
        sourceSystem_externalId: {
          sourceSystem: $Enums.SourceSystem.CIPA,
          externalId,
        },
      },
      include: {
        employee: true,
        sector: true,
        cycle: true,
      },
    });
  }

  async upsertBySourceAndExternalId(data: {
    cycleId: string;
    sourceSystem: $Enums.SourceSystem;
    externalId: string;
    employeeId: string | null;
    sectorId: string;
    accidentType: $Enums.AccidentType;
    occurredAt: Date;
    daysAway: number | null;
    description: string | null;
    status: $Enums.AccidentStatus;
    rawPayload: Prisma.InputJsonValue | null;
    lastSyncedAt: Date;
    sourceChangedAt?: Date | null;
    cancelledAt?: Date | null;
    reviewedAt?: Date | null;
    reviewedByUserId?: string | null;
    rejectionReason?: string | null;
  }) {
    return this.prisma.safetyAccident.upsert({
      where: {
        sourceSystem_externalId: {
          sourceSystem: data.sourceSystem,
          externalId: data.externalId,
        },
      },
      create: {
        cycleId: data.cycleId,
        sourceSystem: data.sourceSystem,
        externalId: data.externalId,
        employeeId: data.employeeId,
        sectorId: data.sectorId,
        accidentType: data.accidentType,
        occurredAt: data.occurredAt,
        daysAway: data.daysAway,
        description: data.description,
        status: data.status,
        rawPayload: data.rawPayload ?? Prisma.JsonNull,
        importedAt: data.lastSyncedAt,
        lastSyncedAt: data.lastSyncedAt,
        sourceChangedAt: data.sourceChangedAt ?? null,
        cancelledAt: data.cancelledAt ?? null,
        reviewedAt: data.reviewedAt ?? null,
        reviewedByUserId: data.reviewedByUserId ?? null,
        rejectionReason: data.rejectionReason ?? null,
      },
      update: {
        cycleId: data.cycleId,
        employeeId: data.employeeId,
        sectorId: data.sectorId,
        accidentType: data.accidentType,
        occurredAt: data.occurredAt,
        daysAway: data.daysAway,
        description: data.description,
        status: data.status,
        rawPayload: data.rawPayload ?? Prisma.JsonNull,
        lastSyncedAt: data.lastSyncedAt,
        sourceChangedAt: data.sourceChangedAt ?? null,
        cancelledAt: data.cancelledAt ?? null,
        reviewedAt: data.reviewedAt ?? null,
        reviewedByUserId: data.reviewedByUserId ?? null,
        rejectionReason: data.rejectionReason ?? null,
      },
    });
  }

  async updateCurrentState(
    id: string,
    data: {
      cycleId?: string;
      employeeId?: string | null;
      sectorId?: string;
      accidentType?: $Enums.AccidentType;
      occurredAt?: Date;
      daysAway?: number | null;
      description?: string | null;
      status?: $Enums.AccidentStatus;
      rawPayload?: Prisma.InputJsonValue | null;
      lastSyncedAt?: Date;
      sourceChangedAt?: Date | null;
      cancelledAt?: Date | null;
      reviewedAt?: Date | null;
      reviewedByUserId?: string | null;
      rejectionReason?: string | null;
    },
  ) {
    return this.prisma.safetyAccident.update({
      where: { id },
      data: {
        ...(data.cycleId !== undefined ? { cycleId: data.cycleId } : {}),
        ...(data.employeeId !== undefined ? { employeeId: data.employeeId } : {}),
        ...(data.sectorId !== undefined ? { sectorId: data.sectorId } : {}),
        ...(data.accidentType !== undefined
          ? { accidentType: data.accidentType }
          : {}),
        ...(data.occurredAt !== undefined ? { occurredAt: data.occurredAt } : {}),
        ...(data.daysAway !== undefined ? { daysAway: data.daysAway } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.rawPayload !== undefined
          ? { rawPayload: data.rawPayload ?? Prisma.JsonNull }
          : {}),
        ...(data.lastSyncedAt !== undefined
          ? { lastSyncedAt: data.lastSyncedAt }
          : {}),
        ...(data.sourceChangedAt !== undefined
          ? { sourceChangedAt: data.sourceChangedAt }
          : {}),
        ...(data.cancelledAt !== undefined ? { cancelledAt: data.cancelledAt } : {}),
        ...(data.reviewedAt !== undefined ? { reviewedAt: data.reviewedAt } : {}),
        ...(data.reviewedByUserId !== undefined
          ? { reviewedByUserId: data.reviewedByUserId }
          : {}),
        ...(data.rejectionReason !== undefined
          ? { rejectionReason: data.rejectionReason }
          : {}),
      },
    });
  }

  async cancelById(
    id: string,
    data: {
      sourceChangedAt: Date;
      cancelledAt: Date;
      lastSyncedAt: Date;
    },
  ) {
    return this.updateCurrentState(id, {
      status: $Enums.AccidentStatus.CANCELLED,
      sourceChangedAt: data.sourceChangedAt,
      cancelledAt: data.cancelledAt,
      lastSyncedAt: data.lastSyncedAt,
    });
  }

  async findByCycleId(cycleId: string) {
    return this.prisma.safetyAccident.findMany({
      where: {
        cycleId,
        status: { not: $Enums.AccidentStatus.CANCELLED },
      },
      include: {
        employee: true,
        sector: true,
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findById(id: string) {
    return this.prisma.safetyAccident.findUnique({
      where: { id },
      include: {
        employee: true,
        sector: true,
        cycle: true,
      },
    });
  }

  async findValidatedByCycleId(cycleId: string) {
    return this.prisma.safetyAccident.findMany({
      where: {
        cycleId,
        status: $Enums.AccidentStatus.VALIDATED,
        accidentType: { in: SCOREABLE_TYPES },
      },
    });
  }

  async countRealAccidentsByCycleId(cycleId: string) {
    const rows = await this.prisma.safetyAccident.findMany({
      where: { cycleId },
      select: { status: true, accidentType: true },
    });
    return rows.filter((row) => isRealAccidentCount(row)).length;
  }

  async updateReview(
    id: string,
    data: {
      status: $Enums.AccidentStatus;
      reviewedAt: Date;
      reviewedByUserId: string;
      rejectionReason: string | null;
    },
  ) {
    return this.prisma.safetyAccident.update({
      where: { id },
      data,
    });
  }

  async countByCycleAndStatus(cycleId: string) {
    const groups = await this.prisma.safetyAccident.groupBy({
      by: ['status'],
      where: {
        cycleId,
        accidentType: { not: $Enums.AccidentType.FREQUENCY },
      },
      _count: { _all: true },
    });
    return groups;
  }
}

export class IndicatorResultPrismaRepository {
  constructor(private prisma: PrismaClient | Prisma.TransactionClient) {}

  async upsert(data: {
    cycleId: string;
    indicatorId: string;
    scope: $Enums.IndicatorScope;
    scopeKey: string;
    sectorId: string | null;
    employeeId: string | null;
    rawValue: Prisma.Decimal | null;
    targetValue: Prisma.Decimal | null;
    preservedInternalPoints: Prisma.Decimal;
    weightedP5Points: Prisma.Decimal;
    status: $Enums.ResultStatus;
    calculationDetails: Prisma.InputJsonValue;
    calculatedAt: Date;
  }) {
    return this.prisma.indicatorResult.upsert({
      where: {
        cycleId_indicatorId_scope_scopeKey: {
          cycleId: data.cycleId,
          indicatorId: data.indicatorId,
          scope: data.scope,
          scopeKey: data.scopeKey,
        },
      },
      create: {
        ...data,
        calculationDetails: data.calculationDetails,
      },
      update: {
        sectorId: data.sectorId,
        employeeId: data.employeeId,
        rawValue: data.rawValue,
        targetValue: data.targetValue,
        preservedInternalPoints: data.preservedInternalPoints,
        weightedP5Points: data.weightedP5Points,
        status: data.status,
        calculationDetails: data.calculationDetails,
        calculatedAt: data.calculatedAt,
      },
    });
  }

  async findByCycleId(cycleId: string) {
    return this.prisma.indicatorResult.findMany({
      where: { cycleId },
      include: {
        indicator: true,
        sector: true,
      },
      orderBy: [{ scopeKey: 'asc' }, { indicatorId: 'asc' }],
    });
  }

  async findManualFrequency(
    cycleId: string,
    indicatorId: string,
    scopeKey: string,
  ) {
    return this.prisma.indicatorResult.findUnique({
      where: {
        cycleId_indicatorId_scope_scopeKey: {
          cycleId,
          indicatorId,
          scope: $Enums.IndicatorScope.SECTOR,
          scopeKey,
        },
      },
    });
  }
}

export class EmployeePillarScorePrismaRepository {
  constructor(private prisma: PrismaClient | Prisma.TransactionClient) {}

  async upsert(data: {
    participantId: string;
    pillarId: string;
    internalScore: Prisma.Decimal;
    weightedPoints: Prisma.Decimal;
    status: $Enums.ResultStatus;
    calculationDetails: Prisma.InputJsonValue;
    calculatedAt: Date;
  }) {
    return this.prisma.employeePillarScore.upsert({
      where: {
        participantId_pillarId: {
          participantId: data.participantId,
          pillarId: data.pillarId,
        },
      },
      create: data,
      update: {
        internalScore: data.internalScore,
        weightedPoints: data.weightedPoints,
        status: data.status,
        calculationDetails: data.calculationDetails,
        calculatedAt: data.calculatedAt,
      },
    });
  }
}

export class EmployeeMonthlyScorePrismaRepository {
  constructor(private prisma: PrismaClient | Prisma.TransactionClient) {}

  async upsert(data: {
    participantId: string;
    totalPoints: Prisma.Decimal;
    status: $Enums.ResultStatus;
    isPartial: boolean;
    calculatedPillars: Prisma.InputJsonValue;
    pendingPillars: Prisma.InputJsonValue;
    calculatedAt: Date;
  }) {
    return this.prisma.employeeMonthlyScore.upsert({
      where: { participantId: data.participantId },
      create: data,
      update: {
        totalPoints: data.totalPoints,
        status: data.status,
        isPartial: data.isPartial,
        calculatedPillars: data.calculatedPillars,
        pendingPillars: data.pendingPillars,
        calculatedAt: data.calculatedAt,
      },
    });
  }
}
