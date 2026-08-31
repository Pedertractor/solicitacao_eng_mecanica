import { $Enums, Prisma } from '../generated/prisma/client.js';
import {
  ANNUAL_BASE_POINTS,
  CYCLES_PER_PROGRAM_YEAR,
  MONTHLY_BASE_POINTS,
} from '../constants/p5-scoring.js';
import { HttpError } from '../https/errors/index.js';
import {
  centsToNumber,
  decimalToUnits,
  divFloor,
  sumCents,
  toCents,
} from '../lib/fixed-point.js';
import { prisma } from '../lib/prisma.js';
import {
  IndicatorConfigPrismaRepository,
  PillarConfigPrismaRepository,
  ProgramYearPrismaRepository,
} from '../repositories/prisma/program-year-repository.js';
import { MonthlyCycleService } from './monthly-cycle-service.js';
import { SAFETY_P5_MAX_POINTS } from './safety-calculation-service.js';
import {
  canViewSafety,
  filterByPillarCode,
  type ScopedPillarCodes,
  visibleMaxPoints,
} from './pillar-scope-service.js';
import { P5AuditService } from './p5-audit-service.js';
import { ensureAbsenteeismIndividualIndicatorForProgram } from './absenteeism-indicator-config.js';

function decimalToNumber(value: Prisma.Decimal | number | string) {
  return decimalToUnits(value);
}

const AVAILABLE_PILLAR_CODES = new Set<string>([
  $Enums.PillarCode.SAFETY,
  $Enums.PillarCode.ABSENTEEISM,
]);

export { AVAILABLE_PILLAR_CODES };

const DEFAULT_PILLARS: Array<{
  code: $Enums.PillarCode;
  name: string;
  maxPoints: number;
}> = [
  { code: $Enums.PillarCode.SAFETY, name: 'Segurança', maxPoints: 20 },
  {
    code: $Enums.PillarCode.PRODUCTIVITY,
    name: 'Produtividade',
    maxPoints: 25,
  },
  { code: $Enums.PillarCode.QUALITY_5S, name: 'Qualidade 5S', maxPoints: 20 },
  { code: $Enums.PillarCode.ABSENTEEISM, name: 'Absenteísmo', maxPoints: 10 },
  { code: $Enums.PillarCode.REVENUE, name: 'Faturamento', maxPoints: 25 },
];

export class ProgramYearService {
  async list(allowedPillarCodes?: ScopedPillarCodes) {
    const repo = new ProgramYearPrismaRepository(prisma);
    const rows = await repo.findAll();
    return rows.map((row) => ({
      id: row.id,
      year: row.year,
      name: row.name,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      active: row.active,
      cyclesCount: row._count.cycles,
      pillars: filterByPillarCode(
        row.pillars.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          maxPoints: decimalToNumber(p.maxPoints),
          active: p.active,
        })),
        allowedPillarCodes ?? null,
      ),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async getById(id: string, allowedPillarCodes?: ScopedPillarCodes) {
    const repo = new ProgramYearPrismaRepository(prisma);
    const row = await repo.findById(id);
    if (!row) throw new HttpError('Programa anual não encontrado', 404);
    return {
      id: row.id,
      year: row.year,
      name: row.name,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      active: row.active,
      pillars: filterByPillarCode(
        row.pillars.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          maxPoints: decimalToNumber(p.maxPoints),
          active: p.active,
        })),
        allowedPillarCodes ?? null,
      ),
      cycles: row.cycles.map((c) => ({
        id: c.id,
        month: c.month,
        year: c.year,
        status: c.status,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async create(input: {
    year: number;
    name: string;
    startsAt: string;
    endsAt: string;
    active?: boolean;
    actorUserId?: string | null;
  }) {
    const repo = new ProgramYearPrismaRepository(prisma);
    const existing = await repo.findByYear(input.year);
    if (existing) {
      throw new HttpError('Já existe um programa para este ano', 400);
    }

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new HttpError('Datas inválidas', 400);
    }
    if (endsAt < startsAt) {
      throw new HttpError('endsAt deve ser posterior a startsAt', 400);
    }

    const created = await repo.create({
      year: input.year,
      name: input.name,
      startsAt,
      endsAt,
      active: input.active ?? true,
    });

    const { MonthlyCycleService } = await import('./monthly-cycle-service.js');
    await new MonthlyCycleService().ensureYearCycles(
      created.id,
      input.actorUserId,
    );
    await ensureAbsenteeismIndividualIndicatorForProgram(created.id);

    await new P5AuditService().log({
      userId: input.actorUserId ?? null,
      action: 'PROGRAM_YEAR_CREATE',
      entityType: 'ProgramYear',
      entityId: created.id,
      after: {
        year: created.year,
        name: created.name,
        cyclesGenerated: 12,
      },
    });

    return this.getById(created.id);
  }

  async listPillars(
    programYearId: string,
    allowedPillarCodes?: ScopedPillarCodes | null,
  ) {
    await this.getById(programYearId, allowedPillarCodes ?? null);
    const repo = new PillarConfigPrismaRepository(prisma);
    const pillars = await repo.findByProgramYearId(programYearId);
    const mapped = pillars.map((p) => ({
      id: p.id,
      programYearId: p.programYearId,
      code: p.code,
      name: p.name,
      maxPoints: decimalToNumber(p.maxPoints),
      active: p.active,
      indicators: p.indicators.map((i) => ({
        id: i.id,
        code: i.code,
        name: i.name,
        scope: i.scope,
        calculationType: i.calculationType,
        maxInternalPoints: decimalToNumber(i.maxInternalPoints),
        target: i.target == null ? null : decimalToNumber(i.target),
        targetOperator: i.targetOperator,
        sourceSystem: i.sourceSystem,
        ruleConfig: i.ruleConfig,
        active: i.active,
      })),
    }));
    if (!allowedPillarCodes) return mapped;
    return mapped.filter((pillar) =>
      allowedPillarCodes.includes(pillar.code as $Enums.PillarCode),
    );
  }

  /**
   * Visão geral do programa: junta os 12 ciclos com pontuação da fábrica
   * (Segurança calculada + demais pilares em preservação).
   */
  async getOverview(
    programYearId: string,
    allowedPillarCodes?: ScopedPillarCodes | null,
  ) {
    const program = await this.getById(programYearId, allowedPillarCodes ?? null);
    const cycles = await new MonthlyCycleService().list(
      { programYearId },
      allowedPillarCodes ?? null,
    );

    const sortedCycles = [...cycles].sort((a, b) => a.month - b.month);
    const cycleIds = sortedCycles.map((c) => c.id);

    let pillarConfigs =
      program.pillars.length > 0
        ? program.pillars.map((p) => ({
            code: p.code as $Enums.PillarCode,
            name: p.name,
            maxPoints: p.maxPoints,
          }))
        : DEFAULT_PILLARS;

    if (allowedPillarCodes) {
      pillarConfigs = pillarConfigs.filter((pillar) =>
        allowedPillarCodes.includes(pillar.code),
      );
    }

    const visibleMonthlyMax = visibleMaxPoints(
      pillarConfigs.map((pillar) => ({
        code: pillar.code,
        maxPoints: pillar.maxPoints,
      })),
      allowedPillarCodes ?? null,
    );
    const visibleAnnualMax = visibleMonthlyMax * CYCLES_PER_PROGRAM_YEAR;
    const includesSafety = canViewSafety(allowedPillarCodes ?? null);
    const visiblePillarCodes = pillarConfigs.map((pillar) => pillar.code);

    const pillarScores =
      cycleIds.length === 0 || visiblePillarCodes.length === 0
        ? []
        : await prisma.employeePillarScore.findMany({
            where: {
              pillar: { code: { in: visiblePillarCodes } },
              participant: {
                cycleId: { in: cycleIds },
                activeInCycle: true,
              },
            },
            select: {
              weightedPoints: true,
              pillar: { select: { code: true } },
              participant: { select: { cycleId: true } },
            },
          });

    const scoresByCycleAndPillar = new Map<
      string,
      { sumCents: number; count: number }
    >();
    for (const row of pillarScores) {
      const key = `${row.participant.cycleId}:${row.pillar.code}`;
      const current = scoresByCycleAndPillar.get(key) ?? {
        sumCents: 0,
        count: 0,
      };
      current.sumCents += toCents(row.weightedPoints);
      current.count += 1;
      scoresByCycleAndPillar.set(key, current);
    }

    const statusCounts: Record<string, number> = {};
    let annualFactoryScoreCents = 0;
    let scoredCyclesCount = 0;
    const annualPointsByPillar = new Map<string, number>();
    let anyPartial = false;

    const cycleOverviews = sortedCycles.map((cycle) => {
      statusCounts[cycle.status] = (statusCounts[cycle.status] ?? 0) + 1;

      const isDraft = cycle.status === $Enums.CycleStatus.DRAFT;
      let safetyPoints: number | null = null;
      let factoryScore: number | null = null;
      let isPartial = true;

      if (!isDraft) {
        let factoryScoreCents = 0;
        for (const pillar of pillarConfigs) {
          const agg = scoresByCycleAndPillar.get(`${cycle.id}:${pillar.code}`);
          const pillarPointsCents =
            agg && agg.count > 0
              ? divFloor(agg.sumCents, agg.count)
              : toCents(pillar.maxPoints);
          factoryScoreCents += pillarPointsCents;
          annualPointsByPillar.set(
            pillar.code,
            (annualPointsByPillar.get(pillar.code) ?? 0) + pillarPointsCents,
          );
          if (pillar.code === $Enums.PillarCode.SAFETY && includesSafety) {
            safetyPoints = centsToNumber(pillarPointsCents);
          }
        }
        factoryScore = centsToNumber(factoryScoreCents);
        isPartial = true;
        anyPartial = true;
        annualFactoryScoreCents += factoryScoreCents;
        scoredCyclesCount += 1;
      }

      return {
        id: cycle.id,
        month: cycle.month,
        year: cycle.year,
        status: cycle.status,
        participantsCount: cycle.participantsCount,
        accidentsCount: includesSafety ? cycle.accidentsCount : null,
        openedAt: cycle.openedAt,
        calculatedAt: cycle.calculatedAt,
        safetyPoints: includesSafety ? safetyPoints : null,
        factoryScore,
        isPartial: isDraft ? null : isPartial,
      };
    });

    const pillars = pillarConfigs.map((pillar) => {
      const available = AVAILABLE_PILLAR_CODES.has(pillar.code);
      const maxPointsMonthly = pillar.maxPoints;
      const maxPointsAnnual = maxPointsMonthly * CYCLES_PER_PROGRAM_YEAR;
      const annualPointsCents = annualPointsByPillar.get(pillar.code) ?? 0;
      const averageMonthlyPoints =
        scoredCyclesCount === 0
          ? null
          : centsToNumber(divFloor(annualPointsCents, scoredCyclesCount));

      return {
        code: pillar.code,
        name: pillar.name,
        maxPointsMonthly,
        maxPointsAnnual,
        averageMonthlyPoints,
        annualPoints:
          scoredCyclesCount === 0 ? null : centsToNumber(annualPointsCents),
        available,
      };
    });

    return {
      programYear: {
        id: program.id,
        year: program.year,
        name: program.name,
        active: program.active,
      },
      monthlyBasePoints: visibleMonthlyMax,
      annualBasePoints: visibleAnnualMax,
      cyclesCount: sortedCycles.length,
      cyclesExpected: CYCLES_PER_PROGRAM_YEAR,
      statusCounts,
      scoredCyclesCount,
      annualFactoryScore: centsToNumber(annualFactoryScoreCents),
      annualFactoryScoreMax: visibleAnnualMax,
      isPartial: anyPartial || scoredCyclesCount < CYCLES_PER_PROGRAM_YEAR,
      pillars,
      cycles: cycleOverviews,
    };
  }

  async listIndicators(pillarId: string) {
    const pillarRepo = new PillarConfigPrismaRepository(prisma);
    const pillar = await pillarRepo.findById(pillarId);
    if (!pillar) throw new HttpError('Pilar não encontrado', 404);

    return pillar.indicators.map((i) => ({
      id: i.id,
      pillarId: i.pillarId,
      code: i.code,
      name: i.name,
      scope: i.scope,
      calculationType: i.calculationType,
      maxInternalPoints: decimalToNumber(i.maxInternalPoints),
      target: i.target == null ? null : decimalToNumber(i.target),
      targetOperator: i.targetOperator,
      sourceSystem: i.sourceSystem,
      ruleConfig: i.ruleConfig,
      active: i.active,
    }));
  }

  async updateIndicator(
    indicatorId: string,
    input: {
      name?: string;
      target?: number | null;
      targetOperator?: string | null;
      ruleConfig?: Prisma.InputJsonValue | null;
      active?: boolean;
      maxInternalPoints?: number;
      actorUserId?: string | null;
    },
  ) {
    const repo = new IndicatorConfigPrismaRepository(prisma);
    const existing = await repo.findById(indicatorId);
    if (!existing) throw new HttpError('Indicador não encontrado', 404);

    const pillar = await new PillarConfigPrismaRepository(prisma).findById(
      existing.pillarId,
    );
    if (!pillar) throw new HttpError('Pilar não encontrado', 404);

    const updated = await repo.update(indicatorId, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.target !== undefined
        ? {
            target:
              input.target === null
                ? null
                : new Prisma.Decimal(input.target),
          }
        : {}),
      ...(input.targetOperator !== undefined
        ? { targetOperator: input.targetOperator }
        : {}),
      ...(input.ruleConfig !== undefined
        ? { ruleConfig: input.ruleConfig }
        : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.maxInternalPoints !== undefined
        ? { maxInternalPoints: new Prisma.Decimal(input.maxInternalPoints) }
        : {}),
    });

    await new P5AuditService().log({
      userId: input.actorUserId ?? null,
      action: 'INDICATOR_UPDATE',
      entityType: 'IndicatorConfig',
      entityId: indicatorId,
      before: {
        name: existing.name,
        active: existing.active,
      },
      after: {
        name: updated.name,
        active: updated.active,
      },
      metadata: {
        pillarCode: pillar.code,
      },
    });

    return {
      id: updated.id,
      pillarId: updated.pillarId,
      code: updated.code,
      name: updated.name,
      scope: updated.scope,
      calculationType: updated.calculationType,
      maxInternalPoints: decimalToNumber(updated.maxInternalPoints),
      target: updated.target == null ? null : decimalToNumber(updated.target),
      targetOperator: updated.targetOperator,
      sourceSystem: updated.sourceSystem,
      ruleConfig: updated.ruleConfig,
      active: updated.active,
    };
  }
}
