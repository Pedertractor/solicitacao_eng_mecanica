import {
  $Enums,
  Prisma,
  PrismaClient,
} from '../../generated/prisma/client.js';

export class MonthlyCyclePrismaRepository {
  constructor(private prisma: PrismaClient | Prisma.TransactionClient) {}

  async create(data: {
    programYearId: string;
    month: number;
    year: number;
    status?: $Enums.CycleStatus;
  }) {
    return this.prisma.monthlyCycle.create({
      data: {
        programYearId: data.programYearId,
        month: data.month,
        year: data.year,
        status: data.status ?? $Enums.CycleStatus.DRAFT,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.monthlyCycle.findUnique({
      where: { id },
      include: {
        programYear: true,
        _count: {
          select: {
            participants: true,
            accidents: true,
          },
        },
      },
    });
  }

  async findAll(filters?: { programYearId?: string; year?: number }) {
    return this.prisma.monthlyCycle.findMany({
      where: {
        ...(filters?.programYearId
          ? { programYearId: filters.programYearId }
          : {}),
        ...(filters?.year !== undefined ? { year: filters.year } : {}),
      },
      include: {
        programYear: true,
        _count: {
          select: {
            participants: true,
            accidents: true,
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async findByProgramYearAndMonth(
    programYearId: string,
    year: number,
    month: number,
  ) {
    return this.prisma.monthlyCycle.findUnique({
      where: {
        programYearId_year_month: {
          programYearId,
          year,
          month,
        },
      },
    });
  }

  async createManySkipDuplicates(
    data: Array<{
      programYearId: string;
      month: number;
      year: number;
      status?: $Enums.CycleStatus;
    }>,
  ) {
    return this.prisma.monthlyCycle.createMany({
      data: data.map((row) => ({
        programYearId: row.programYearId,
        month: row.month,
        year: row.year,
        status: row.status ?? $Enums.CycleStatus.DRAFT,
      })),
      skipDuplicates: true,
    });
  }

  async countByProgramYearId(programYearId: string) {
    return this.prisma.monthlyCycle.count({ where: { programYearId } });
  }

  async updateStatus(
    id: string,
    data: {
      status: $Enums.CycleStatus;
      openedAt?: Date | null;
      calculatedAt?: Date | null;
      submittedAt?: Date | null;
      homologatedAt?: Date | null;
      lockedAt?: Date | null;
    },
  ) {
    return this.prisma.monthlyCycle.update({
      where: { id },
      data,
    });
  }

  async findWorkingByProgramYear(
    programYearId: string,
    excludeCycleId?: string,
  ) {
    return this.prisma.monthlyCycle.findMany({
      where: {
        programYearId,
        status: {
          in: [$Enums.CycleStatus.OPEN, $Enums.CycleStatus.CALCULATED],
        },
        ...(excludeCycleId ? { NOT: { id: excludeCycleId } } : {}),
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });
  }

  /**
   * Ciclo editável do programa: OPEN → CALCULATED → UNDER_REVIEW.
   * Retorna no máximo um (preferência de status, depois mês mais recente).
   */
  async findWritableByProgramYear(programYearId: string) {
    const rows = await this.prisma.monthlyCycle.findMany({
      where: {
        programYearId,
        status: {
          in: [
            $Enums.CycleStatus.OPEN,
            $Enums.CycleStatus.CALCULATED,
            $Enums.CycleStatus.UNDER_REVIEW,
          ],
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    const preference: Record<$Enums.CycleStatus, number> = {
      [$Enums.CycleStatus.OPEN]: 0,
      [$Enums.CycleStatus.CALCULATED]: 1,
      [$Enums.CycleStatus.UNDER_REVIEW]: 2,
      [$Enums.CycleStatus.DRAFT]: 99,
      [$Enums.CycleStatus.HOMOLOGATED]: 99,
      [$Enums.CycleStatus.LOCKED]: 99,
    };

    rows.sort((a, b) => {
      const byStatus = preference[a.status] - preference[b.status];
      if (byStatus !== 0) return byStatus;
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    return rows[0] ?? null;
  }

  async updateScoringConfig(id: string, config: Prisma.InputJsonValue) {
    return this.prisma.monthlyCycle.update({
      where: { id },
      data: { scoringConfig: config },
    });
  }

  async resetAllToDraft(programYearId?: string) {
    return this.prisma.monthlyCycle.updateMany({
      where: programYearId ? { programYearId } : {},
      data: {
        status: $Enums.CycleStatus.DRAFT,
        openedAt: null,
        calculatedAt: null,
        submittedAt: null,
        homologatedAt: null,
        lockedAt: null,
      },
    });
  }
}

export class CycleParticipantPrismaRepository {
  constructor(private prisma: PrismaClient | Prisma.TransactionClient) {}

  async upsert(data: {
    cycleId: string;
    employeeId: string;
    sectorId: string;
    employeeNameSnapshot: string;
    sectorNameSnapshot: string;
    unitSnapshot: $Enums.Unit;
    activeInCycle: boolean;
  }) {
    return this.prisma.cycleParticipant.upsert({
      where: {
        cycleId_employeeId: {
          cycleId: data.cycleId,
          employeeId: data.employeeId,
        },
      },
      create: data,
      update: {
        sectorId: data.sectorId,
        employeeNameSnapshot: data.employeeNameSnapshot,
        sectorNameSnapshot: data.sectorNameSnapshot,
        unitSnapshot: data.unitSnapshot,
        activeInCycle: data.activeInCycle,
      },
    });
  }

  async findByCycleId(cycleId: string) {
    return this.prisma.cycleParticipant.findMany({
      where: { cycleId },
      include: {
        employee: true,
        sector: true,
        monthlyScore: true,
        pillarScores: { include: { pillar: true } },
      },
      orderBy: { employeeNameSnapshot: 'asc' },
    });
  }

  async findActiveByCycleId(cycleId: string) {
    return this.prisma.cycleParticipant.findMany({
      where: { cycleId, activeInCycle: true },
      include: { sector: true, employee: true },
    });
  }

  async deactivateMissing(cycleId: string, keepEmployeeIds: string[]) {
    return this.prisma.cycleParticipant.updateMany({
      where: {
        cycleId,
        employeeId: { notIn: keepEmployeeIds },
        activeInCycle: true,
      },
      data: { activeInCycle: false },
    });
  }

  async countByCycleId(cycleId: string) {
    return this.prisma.cycleParticipant.count({
      where: { cycleId, activeInCycle: true },
    });
  }
}
