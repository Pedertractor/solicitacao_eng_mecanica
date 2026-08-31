import { $Enums, Prisma, PrismaClient } from '../../generated/prisma/client.js';

export class ProgramYearPrismaRepository {
  constructor(private prisma: PrismaClient | Prisma.TransactionClient) {}

  async create(data: {
    year: number;
    name: string;
    startsAt: Date;
    endsAt: Date;
    active: boolean;
  }) {
    return this.prisma.programYear.create({ data });
  }

  async findById(id: string) {
    return this.prisma.programYear.findUnique({
      where: { id },
      include: {
        pillars: { orderBy: { code: 'asc' } },
        cycles: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
      },
    });
  }

  async findByYear(year: number) {
    return this.prisma.programYear.findUnique({ where: { year } });
  }

  async findAll() {
    return this.prisma.programYear.findMany({
      orderBy: { year: 'desc' },
      include: {
        pillars: { orderBy: { code: 'asc' } },
        _count: { select: { cycles: true } },
      },
    });
  }

  async findActive() {
    return this.prisma.programYear.findFirst({
      where: { active: true },
      orderBy: { year: 'desc' },
      include: {
        pillars: { where: { active: true }, orderBy: { code: 'asc' } },
      },
    });
  }

  async updateScoringConfig(id: string, config: Prisma.InputJsonValue) {
    return this.prisma.programYear.update({
      where: { id },
      data: { scoringConfig: config },
    });
  }
}

export class PillarConfigPrismaRepository {
  constructor(private prisma: PrismaClient | Prisma.TransactionClient) {}

  async findByProgramYearId(programYearId: string) {
    return this.prisma.pillarConfig.findMany({
      where: { programYearId },
      orderBy: { code: 'asc' },
      include: { indicators: { orderBy: { code: 'asc' } } },
    });
  }

  async findById(id: string) {
    return this.prisma.pillarConfig.findUnique({
      where: { id },
      include: { indicators: { orderBy: { code: 'asc' } } },
    });
  }

  async findByProgramYearAndCode(
    programYearId: string,
    code: $Enums.PillarCode,
  ) {
    return this.prisma.pillarConfig.findUnique({
      where: { programYearId_code: { programYearId, code } },
    });
  }
}

export class IndicatorConfigPrismaRepository {
  constructor(private prisma: PrismaClient | Prisma.TransactionClient) {}

  async findByPillarId(pillarId: string) {
    return this.prisma.indicatorConfig.findMany({
      where: { pillarId },
      orderBy: { code: 'asc' },
    });
  }

  async findById(id: string) {
    return this.prisma.indicatorConfig.findUnique({ where: { id } });
  }

  async update(
    id: string,
    data: {
      name?: string;
      target?: Prisma.Decimal | null;
      targetOperator?: string | null;
      ruleConfig?: Prisma.InputJsonValue | null;
      active?: boolean;
      maxInternalPoints?: Prisma.Decimal;
    },
  ) {
    const updateData: Prisma.IndicatorConfigUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.target !== undefined) updateData.target = data.target;
    if (data.targetOperator !== undefined) {
      updateData.targetOperator = data.targetOperator;
    }
    if (data.active !== undefined) updateData.active = data.active;
    if (data.maxInternalPoints !== undefined) {
      updateData.maxInternalPoints = data.maxInternalPoints;
    }
    if (data.ruleConfig !== undefined) {
      updateData.ruleConfig =
        data.ruleConfig === null ? Prisma.JsonNull : data.ruleConfig;
    }

    return this.prisma.indicatorConfig.update({
      where: { id },
      data: updateData,
    });
  }
}
