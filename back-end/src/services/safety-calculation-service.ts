import { $Enums, Prisma } from '../generated/prisma/client.js';
import { HttpError } from '../https/errors/index.js';
import {
  averageCents,
  centsToFixed2,
  centsToNumber,
  decimalToUnits,
  intUnitsToCents,
  proportionToCents,
  toCents,
} from '../lib/fixed-point.js';
import { prisma } from '../lib/prisma.js';
import { CycleParticipantPrismaRepository } from '../repositories/prisma/monthly-cycle-repository.js';
import { MonthlyCyclePrismaRepository } from '../repositories/prisma/monthly-cycle-repository.js';
import { PillarConfigPrismaRepository } from '../repositories/prisma/program-year-repository.js';
import {
  EmployeePillarScorePrismaRepository,
  IndicatorResultPrismaRepository,
  SafetyAccidentPrismaRepository,
} from '../repositories/prisma/safety-repository.js';
import { P5AuditService } from './p5-audit-service.js';
import { rebuildParticipantMonthlyScore } from './participant-monthly-score-service.js';
import {
  clearCycleRecalculating,
  isCycleRecalculating,
  markCycleRecalculating,
} from './safety-calculation-pending.js';
import {
  buildEmployeeSafetyScoreV2,
  computeSafetyFactoryBalance,
  isScoringConfigV2,
  parseScoringConfig,
  resolveZeroBelowPercent,
  thresholdFloorCents,
  type SafetyEmployeeScoreV2,
  type SafetyFactoryBalance,
  type ScoringConfigV2,
} from './scoring-rules.js';

export const SAFETY_P5_MAX_POINTS = 20;
export const SAFETY_INTERNAL_MAX = 100;
export const SAFETY_WITH_LEAVE_PENALTY = 50;
export const SAFETY_WITHOUT_LEAVE_PENALTY = 30;
export const SAFETY_FREQUENCY_PENALTY = 20;

const LEGACY_SECTOR_NOTE =
  'Pontuação individual: −50/com afast., −30/sem afast., −20 se 2+ acidentes; piso 0';
const V2_SECTOR_NOTE =
  'Saldo coletivo da fábrica (20 − perdas por acidente); abaixo do limiar (70%) zera todos; vítima perde multa individual P5';

function decimalAsPrisma(cents: number) {
  return new Prisma.Decimal(centsToFixed2(cents));
}

export type ZeroOccurrenceInput = {
  validatedOccurrences: number;
  maxInternalPoints: number;
};

/** Regra ZERO_OCCURRENCE: 0 ocorrências preserva max; 1+ zera. */
export function applyZeroOccurrenceRule(
  input: ZeroOccurrenceInput,
): number {
  return input.validatedOccurrences === 0 ? input.maxInternalPoints : 0;
}

/** Conversão interno → P5 em centésimos (aritmética inteira). */
export function convertInternalToP5Cents(
  preservedInternalPoints: number,
  pillarMaxPoints = SAFETY_P5_MAX_POINTS,
): number {
  const cappedInternal = Math.min(
    Math.max(Math.trunc(preservedInternalPoints), 0),
    SAFETY_INTERNAL_MAX,
  );
  const maxCents = intUnitsToCents(pillarMaxPoints);
  const weightedCents = proportionToCents(
    cappedInternal,
    SAFETY_INTERNAL_MAX,
    pillarMaxPoints,
  );
  return Math.min(weightedCents, maxCents);
}

export type SafetyEmployeeLossDetail = {
  participantId: string;
  employeeId: string;
  cardNumber: string;
  name: string;
  withLeave: number;
  withoutLeave: number;
  internalScore: number | null;
  weightedP5: number | null;
  scoringRuleVersion?: 1 | 2;
  /** Legado 50/30/20 */
  isRecidivist?: boolean;
  withLeaveDeduction?: number;
  withoutLeaveDeduction?: number;
  frequencyDeduction?: number;
  rawInternal?: number;
  flooredAtZero?: boolean;
  /** V2 coletivo */
  factoryDeductionP5?: number;
  individualDeductionP5?: number;
  factoryBalanceP5?: number;
  factoryZeroed?: boolean;
  zeroedBy?: 'factory_threshold' | 'individual_threshold' | null;
  zeroBelowPercent?: number;
  floorP5?: number;
  withLeaveCount?: number;
  withoutLeaveCount?: number;
};

function mapSafetyEmployeeLossDetail(
  participant: {
    id: string;
    employeeId: string;
    employeeNameSnapshot: string;
    employee: { employeeId: string };
  },
  score: {
    internalScore: Prisma.Decimal | number;
    weightedPoints: Prisma.Decimal | number;
    calculationDetails: unknown;
  } | null,
  options?: {
    /** Ciclo com scoringConfig v2 — nunca expor UI/detalhe legado. */
    forceV2?: boolean;
    config?: ScoringConfigV2;
  },
): SafetyEmployeeLossDetail {
  const details =
    score?.calculationDetails &&
    typeof score.calculationDetails === 'object'
      ? (score.calculationDetails as Record<string, unknown>)
      : null;

  const withLeaveCount =
    typeof details?.withLeaveCount === 'number' ? details.withLeaveCount : 0;
  const withoutLeaveCount =
    typeof details?.withoutLeaveCount === 'number'
      ? details.withoutLeaveCount
      : 0;

  const isV2 =
    options?.forceV2 === true ||
    details?.scoringRuleVersion === 2 ||
    typeof details?.factoryBalanceP5 === 'number' ||
    typeof details?.factoryDeductionP5 === 'number';

  const base: SafetyEmployeeLossDetail = {
    participantId: participant.id,
    employeeId: participant.employeeId,
    cardNumber: participant.employee.employeeId,
    name: participant.employeeNameSnapshot,
    withLeave: withLeaveCount,
    withoutLeave: withoutLeaveCount,
    withLeaveCount,
    withoutLeaveCount,
    internalScore: score
      ? centsToNumber(toCents(score.internalScore))
      : null,
    weightedP5: score
      ? centsToNumber(toCents(score.weightedPoints))
      : null,
  };

  if (isV2) {
    const config = options?.config;
    let factoryDeductionP5 =
      typeof details?.factoryDeductionP5 === 'number'
        ? details.factoryDeductionP5
        : undefined;
    let individualDeductionP5 =
      typeof details?.individualDeductionP5 === 'number'
        ? details.individualDeductionP5
        : undefined;
    let factoryBalanceP5 =
      typeof details?.factoryBalanceP5 === 'number'
        ? details.factoryBalanceP5
        : undefined;

    // Score antigo no ciclo v2: estima perdas a partir da config atual.
    if (config && factoryDeductionP5 == null) {
      factoryDeductionP5 = centsToNumber(
        withLeaveCount * toCents(config.safety.withLeave.factoryDeductionP5) +
          withoutLeaveCount *
            toCents(config.safety.withoutLeave.factoryDeductionP5),
      );
    }
    if (config && individualDeductionP5 == null) {
      individualDeductionP5 = centsToNumber(
        withLeaveCount *
          toCents(config.safety.withLeave.individualPenaltyP5) +
          withoutLeaveCount *
            toCents(config.safety.withoutLeave.individualPenaltyP5),
      );
    }
    if (factoryBalanceP5 == null && typeof details?.factoryBalanceP5 === 'number') {
      factoryBalanceP5 = details.factoryBalanceP5;
    }
    // Sem snapshot de fábrica no score antigo: aproxima pelo resultado + individual.
    if (factoryBalanceP5 == null && base.weightedP5 != null) {
      factoryBalanceP5 = centsToNumber(
        Math.min(
          intUnitsToCents(SAFETY_P5_MAX_POINTS),
          toCents(base.weightedP5) + toCents(individualDeductionP5 ?? 0),
        ),
      );
    }

    const detail: SafetyEmployeeLossDetail = {
      ...base,
      scoringRuleVersion: 2,
      factoryZeroed: Boolean(details?.factoryZeroed),
      factoryDeductionP5: factoryDeductionP5 ?? 0,
      individualDeductionP5: individualDeductionP5 ?? 0,
      factoryBalanceP5: factoryBalanceP5 ?? base.weightedP5 ?? 0,
    };
    if (
      details?.zeroedBy === 'factory_threshold' ||
      details?.zeroedBy === 'individual_threshold'
    ) {
      detail.zeroedBy = details.zeroedBy;
    } else if (details?.zeroedBy === null) {
      detail.zeroedBy = null;
    }
    if (typeof details?.zeroBelowPercent === 'number') {
      detail.zeroBelowPercent = details.zeroBelowPercent;
    } else if (config) {
      detail.zeroBelowPercent = resolveZeroBelowPercent(config, 'SAFETY');
    }
    if (typeof details?.floorP5 === 'number') {
      detail.floorP5 = details.floorP5;
    } else if (detail.zeroBelowPercent != null) {
      detail.floorP5 = centsToNumber(
        thresholdFloorCents(SAFETY_P5_MAX_POINTS, detail.zeroBelowPercent),
      );
    }
    // Escala interna = P5 (0–20). Scores antigos em 0–100 são normalizados na exibição.
    if (
      detail.internalScore != null &&
      detail.internalScore > SAFETY_P5_MAX_POINTS &&
      detail.weightedP5 != null
    ) {
      detail.internalScore = detail.weightedP5;
    }
    return detail;
  }

  const isRecidivist = Boolean(details?.isRecidivist);
  const withLeaveDeduction =
    typeof details?.withLeaveDeduction === 'number'
      ? details.withLeaveDeduction
      : withLeaveCount * SAFETY_WITH_LEAVE_PENALTY;
  const withoutLeaveDeduction =
    typeof details?.withoutLeaveDeduction === 'number'
      ? details.withoutLeaveDeduction
      : withoutLeaveCount * SAFETY_WITHOUT_LEAVE_PENALTY;
  const frequencyDeduction =
    typeof details?.frequencyDeduction === 'number'
      ? details.frequencyDeduction
      : isRecidivist
        ? SAFETY_FREQUENCY_PENALTY
        : 0;
  const rawInternal =
    typeof details?.rawInternal === 'number'
      ? details.rawInternal
      : SAFETY_INTERNAL_MAX -
        withLeaveDeduction -
        withoutLeaveDeduction -
        frequencyDeduction;

  return {
    ...base,
    scoringRuleVersion: 1,
    isRecidivist,
    withLeaveDeduction,
    withoutLeaveDeduction,
    frequencyDeduction,
    rawInternal,
    flooredAtZero: rawInternal < 0,
  };
}

/** Conversão interno → P5 em unidades (2 casas), via centésimos. */
export function convertInternalToP5Points(
  preservedInternalPoints: number,
  pillarMaxPoints = SAFETY_P5_MAX_POINTS,
): number {
  return centsToNumber(
    convertInternalToP5Cents(preservedInternalPoints, pillarMaxPoints),
  );
}

/**
 * Pontuação individual de Segurança (base 100) — regra LEGADA 50/30/20.
 * O cálculo ao vivo (performCalculate / recalculate) usa v2 quando
 * cycle.scoringConfig.version === 2; esta função permanece para testes
 * unitários da fórmula antiga e ciclos legados.
 *
 * - cada WITH_LEAVE: −50
 * - cada WITHOUT_LEAVE: −30
 * - 2+ acidentes (com/sem) no ciclo: −20 (reincidência, calculada pelo P5)
 * - piso: 0 (nunca negativo)
 */
export function buildEmployeeSafetyScore(input: {
  withLeaveCount: number;
  withoutLeaveCount: number;
  withLeavePenalty?: number;
  withoutLeavePenalty?: number;
  frequencyPenalty?: number;
}) {
  const withLeavePenalty =
    input.withLeavePenalty ?? SAFETY_WITH_LEAVE_PENALTY;
  const withoutLeavePenalty =
    input.withoutLeavePenalty ?? SAFETY_WITHOUT_LEAVE_PENALTY;
  const frequencyPenalty =
    input.frequencyPenalty ?? SAFETY_FREQUENCY_PENALTY;

  const withLeaveCount = Math.max(0, input.withLeaveCount);
  const withoutLeaveCount = Math.max(0, input.withoutLeaveCount);
  const accidentCount = withLeaveCount + withoutLeaveCount;
  const isRecidivist = accidentCount >= 2;

  const withLeaveDeduction = withLeaveCount * withLeavePenalty;
  const withoutLeaveDeduction = withoutLeaveCount * withoutLeavePenalty;
  const frequencyDeduction = isRecidivist ? frequencyPenalty : 0;
  const frequencyPreserved = isRecidivist ? 0 : frequencyPenalty;

  const rawInternal =
    SAFETY_INTERNAL_MAX -
    withLeaveDeduction -
    withoutLeaveDeduction -
    frequencyDeduction;
  const internalTotal = Math.max(0, rawInternal);
  const weightedP5Cents = convertInternalToP5Cents(internalTotal);

  return {
    withLeaveCount,
    withoutLeaveCount,
    accidentCount,
    isRecidivist,
    withLeaveDeduction,
    withoutLeaveDeduction,
    frequencyDeduction,
    frequencyPreserved,
    rawInternal,
    internalTotal,
    weightedP5Cents,
    weightedP5: centsToNumber(weightedP5Cents),
  };
}

/** @deprecated Mantido para compatibilidade de testes legados. */
export function buildSectorAccidentPreserved(input: {
  withLeaveCount: number;
  withoutLeaveCount: number;
  withLeaveMax: number;
  withoutLeaveMax: number;
}) {
  const withLeavePreserved = applyZeroOccurrenceRule({
    validatedOccurrences: input.withLeaveCount,
    maxInternalPoints: input.withLeaveMax,
  });
  const withoutLeavePreserved = applyZeroOccurrenceRule({
    validatedOccurrences: input.withoutLeaveCount,
    maxInternalPoints: input.withoutLeaveMax,
  });
  return {
    withLeavePreserved,
    withoutLeavePreserved,
    sectorInternalBase: withLeavePreserved + withoutLeavePreserved,
  };
}

/** @deprecated Prefer buildEmployeeSafetyScore */
export function buildSectorSafetyBreakdown(input: {
  sectorId: string;
  withLeaveCount: number;
  withoutLeaveCount: number;
  withLeaveMax: number;
  withoutLeaveMax: number;
  frequencyMax: number;
  frequencyManualPoints: number | null;
}) {
  const score = buildEmployeeSafetyScore({
    withLeaveCount: input.withLeaveCount,
    withoutLeaveCount: input.withoutLeaveCount,
    withLeavePenalty: input.withLeaveMax,
    withoutLeavePenalty: input.withoutLeaveMax,
    frequencyPenalty: input.frequencyMax,
  });
  return {
    sectorId: input.sectorId,
    withLeaveCount: input.withLeaveCount,
    withoutLeaveCount: input.withoutLeaveCount,
    withLeavePreserved: Math.max(
      0,
      input.withLeaveMax - score.withLeaveDeduction,
    ),
    withoutLeavePreserved: Math.max(
      0,
      input.withoutLeaveMax - score.withoutLeaveDeduction,
    ),
    frequencyPreserved: score.frequencyPreserved,
    frequencyPending: false,
    internalTotal: score.internalTotal,
    weightedP5: score.weightedP5,
  };
}

function isScoreableAccidentType(type: $Enums.AccidentType) {
  return (
    type === $Enums.AccidentType.WITH_LEAVE ||
    type === $Enums.AccidentType.WITHOUT_LEAVE
  );
}

type PreparedEmployeeScore = {
  participantId: string;
  employeeId: string;
  sectorId: string;
  withLeaveCount: number;
  withoutLeaveCount: number;
  score: ReturnType<typeof buildEmployeeSafetyScore>;
};

type PreparedEmployeeScoreV2 = {
  participantId: string;
  employeeId: string;
  sectorId: string;
  withLeaveCount: number;
  withoutLeaveCount: number;
  score: SafetyEmployeeScoreV2;
};

type SafetyIndicatorRef = {
  id: string;
  maxInternalPoints: string | number | { toFixed(dp: number): string };
};

function recidivismExternalId(cycleId: string, employeeId: string) {
  return `p5-recidivism:${cycleId}:${employeeId}`;
}

/** Na v2, interno = P5 (mesma escala da fábrica). Legado usava ×5 (20→100). */
function p5CentsToInternalScoreCents(weightedP5Cents: number): number {
  return weightedP5Cents;
}

function resolveCycleScoringConfig(cycle: { scoringConfig?: unknown }) {
  return parseScoringConfig(cycle.scoringConfig ?? null);
}

export class SafetyCalculationService {
  /**
   * Mantém no histórico uma linha FREQUENCY (VALIDATED) por colaborador
   * reincidente (2+ acidentes com/sem afastamento no ciclo). Remove se
   * deixar de ser reincidente.
   * Somente regra legada (v1); v2 não gera FREQUENCY.
   */
  async syncRecidivismHistoryRows(cycleId: string, employeeIds?: string[]) {
    const scopedIds = employeeIds
      ? [...new Set(employeeIds.filter(Boolean))]
      : null;
    const accidents = await prisma.safetyAccident.findMany({
      where: {
        cycleId,
        ...(scopedIds && scopedIds.length > 0
          ? { employeeId: { in: scopedIds } }
          : {}),
      },
    });

    const scoreableValidated = accidents.filter(
      (a) =>
        a.status === $Enums.AccidentStatus.VALIDATED &&
        a.employeeId != null &&
        isScoreableAccidentType(a.accidentType),
    );

    const byEmployee = new Map<string, typeof scoreableValidated>();
    for (const accident of scoreableValidated) {
      const employeeId = accident.employeeId!;
      const list = byEmployee.get(employeeId) ?? [];
      list.push(accident);
      byEmployee.set(employeeId, list);
    }

    const recidivistIds = new Set<string>();
    const now = new Date();

    for (const [employeeId, list] of byEmployee) {
      if (list.length < 2) continue;
      recidivistIds.add(employeeId);

      const sorted = [...list].sort(
        (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
      );
      const trigger = sorted[1]!;
      const externalId = recidivismExternalId(cycleId, employeeId);

      await prisma.safetyAccident.upsert({
        where: {
          sourceSystem_externalId: {
            sourceSystem: $Enums.SourceSystem.MANUAL,
            externalId,
          },
        },
        create: {
          cycleId,
          sourceSystem: $Enums.SourceSystem.MANUAL,
          externalId,
          employeeId,
          sectorId: trigger.sectorId,
          accidentType: $Enums.AccidentType.FREQUENCY,
          occurredAt: now,
          daysAway: null,
          description:
            'Reincidência automática (−20): 2+ acidentes validados no ciclo',
          status: $Enums.AccidentStatus.VALIDATED,
          reviewedAt: now,
          rejectionReason: null,
          importedAt: now,
          lastSyncedAt: now,
          cancelledAt: null,
          rawPayload: {
            generatedBy: 'P5',
            rule: 'AUTO_RECIDIVISM',
            triggerAccidentId: trigger.id,
            accidentCount: list.length,
          },
        },
        update: {
          cycleId,
          employeeId,
          sectorId: trigger.sectorId,
          accidentType: $Enums.AccidentType.FREQUENCY,
          daysAway: null,
          description:
            'Reincidência automática (−20): 2+ acidentes validados no ciclo',
          status: $Enums.AccidentStatus.VALIDATED,
          reviewedAt: now,
          rejectionReason: null,
          lastSyncedAt: now,
          cancelledAt: null,
          rawPayload: {
            generatedBy: 'P5',
            rule: 'AUTO_RECIDIVISM',
            triggerAccidentId: trigger.id,
            accidentCount: list.length,
          },
        },
      });
    }

    const staleFrequencyIds = accidents
      .filter(
        (a) =>
          a.accidentType === $Enums.AccidentType.FREQUENCY &&
          a.sourceSystem === $Enums.SourceSystem.MANUAL &&
          a.externalId.startsWith('p5-recidivism:') &&
          (!a.employeeId || !recidivistIds.has(a.employeeId)),
      )
      .map((a) => a.id);

    if (staleFrequencyIds.length > 0) {
      await prisma.safetyAccident.updateMany({
        where: { id: { in: staleFrequencyIds } },
        data: {
          status: $Enums.AccidentStatus.CANCELLED,
          cancelledAt: now,
          lastSyncedAt: now,
        },
      });
    }
  }

  async calculate(cycleId: string, actorUserId?: string | null) {
    markCycleRecalculating(cycleId);
    try {
      return await this.performCalculate(cycleId, actorUserId);
    } finally {
      clearCycleRecalculating(cycleId);
    }
  }

  private async performCalculate(cycleId: string, actorUserId?: string | null) {
    const cycleRepo = new MonthlyCyclePrismaRepository(prisma);
    const cycle = await cycleRepo.findById(cycleId);
    if (!cycle) throw new HttpError('Ciclo não encontrado', 404);

    if (
      cycle.status === $Enums.CycleStatus.HOMOLOGATED ||
      cycle.status === $Enums.CycleStatus.LOCKED
    ) {
      throw new HttpError(
        'Ciclo homologado ou bloqueado não permite novo cálculo',
        400,
      );
    }

    const scoringConfig = resolveCycleScoringConfig(cycle);
    const useV2 = isScoringConfigV2(scoringConfig);

    if (!useV2) {
      await this.syncRecidivismHistoryRows(cycleId);
    }

    const pillarRepo = new PillarConfigPrismaRepository(prisma);
    const safetyPillar = await pillarRepo.findByProgramYearAndCode(
      cycle.programYearId,
      $Enums.PillarCode.SAFETY,
    );
    if (!safetyPillar) {
      throw new HttpError('Pilar Segurança não configurado no programa', 400);
    }

    const pillarWithIndicators = await pillarRepo.findById(safetyPillar.id);
    if (!pillarWithIndicators) {
      throw new HttpError('Pilar Segurança não encontrado', 404);
    }

    const indicators = pillarWithIndicators.indicators.filter((i) => i.active);
    const withLeaveInd = indicators.find((i) => i.code === 'SAFETY_WITH_LEAVE');
    const withoutLeaveInd = indicators.find(
      (i) => i.code === 'SAFETY_WITHOUT_LEAVE',
    );
    const frequencyInd = indicators.find((i) => i.code === 'SAFETY_FREQUENCY');

    if (!withLeaveInd || !withoutLeaveInd || !frequencyInd) {
      throw new HttpError(
        'Indicadores de Segurança incompletos na configuração',
        400,
      );
    }

    const allPillars = await pillarRepo.findByProgramYearId(
      cycle.programYearId,
    );
    const pendingPillars = allPillars
      .filter((p) => p.code !== $Enums.PillarCode.SAFETY && p.active)
      .map((p) => p.code);

    const participantRepo = new CycleParticipantPrismaRepository(prisma);
    const participants = await participantRepo.findActiveByCycleId(cycleId);
    if (participants.length === 0) {
      throw new HttpError('Ciclo sem participantes ativos', 400);
    }

    const accidentRepo = new SafetyAccidentPrismaRepository(prisma);
    const validated = (
      await accidentRepo.findValidatedByCycleId(cycleId)
    ).filter((a) => isScoreableAccidentType(a.accidentType));

    const sectorIds = [...new Set(participants.map((p) => p.sectorId))];
    const calculatedAt = new Date();

    const accidentsByEmployee = new Map<string, typeof validated>();
    for (const accident of validated) {
      if (!accident.employeeId) continue;
      const list = accidentsByEmployee.get(accident.employeeId) ?? [];
      list.push(accident);
      accidentsByEmployee.set(accident.employeeId, list);
    }

    if (useV2) {
      const factoryWithLeaveCount = validated.filter(
        (a) => a.accidentType === $Enums.AccidentType.WITH_LEAVE,
      ).length;
      const factoryWithoutLeaveCount = validated.filter(
        (a) => a.accidentType === $Enums.AccidentType.WITHOUT_LEAVE,
      ).length;
      const factoryBalance = computeSafetyFactoryBalance({
        config: scoringConfig,
        factoryWithLeaveCount,
        factoryWithoutLeaveCount,
      });

      const preparedV2 = this.prepareEmployeeScoresV2(
        participants,
        accidentsByEmployee,
        scoringConfig,
        factoryBalance,
      );

      const employeeScores = preparedV2.map((row) => ({
        participantId: row.participantId,
        employeeId: row.employeeId,
        sectorId: row.sectorId,
        internalTotal: centsToNumber(
          p5CentsToInternalScoreCents(row.score.weightedP5Cents),
        ),
        weightedP5Cents: row.score.weightedP5Cents,
        weightedP5: row.score.weightedP5,
        factoryZeroed: row.score.factoryZeroed,
        zeroedBy: row.score.zeroedBy,
      }));

      await this.persistPreparedScoresV2({
        cycleId,
        programYearId: cycle.programYearId,
        prepared: preparedV2,
        config: scoringConfig,
        factoryBalance,
        withLeaveInd,
        withoutLeaveInd,
        frequencyInd,
        safetyPillarId: safetyPillar.id,
        calculatedAt,
      });

      await new P5AuditService().log({
        userId: actorUserId ?? null,
        action: 'SAFETY_CALCULATE',
        entityType: 'MonthlyCycle',
        entityId: cycleId,
        cycleId,
        metadata: {
          sectors: sectorIds.length,
          participants: participants.length,
          rule: 'FACTORY_BALANCE_V2',
          scoringRuleVersion: 2,
          factoryWithLeaveCount,
          factoryWithoutLeaveCount,
          factoryZeroed: factoryBalance.factoryZeroed,
          pillarCode: 'SAFETY',
        },
      });

      return {
        summary: {
          sectorsCalculated: sectorIds.length,
          participantsScored: participants.length,
          isPartial: true,
          calculatedPillars: [$Enums.PillarCode.SAFETY],
          pendingPillars,
        },
        employees: employeeScores,
      };
    }

    const prepared = this.prepareEmployeeScores(
      participants,
      accidentsByEmployee,
      withLeaveInd,
      withoutLeaveInd,
      frequencyInd,
    );

    const employeeScores = prepared.map((row) => ({
      participantId: row.participantId,
      employeeId: row.employeeId,
      sectorId: row.sectorId,
      internalTotal: row.score.internalTotal,
      weightedP5Cents: row.score.weightedP5Cents,
      weightedP5: row.score.weightedP5,
      frequencyPreserved: row.score.frequencyPreserved,
      isRecidivist: row.score.isRecidivist,
    }));

    await this.persistPreparedScores({
      cycleId,
      programYearId: cycle.programYearId,
      prepared,
      withLeaveInd,
      withoutLeaveInd,
      frequencyInd,
      safetyPillarId: safetyPillar.id,
      calculatedAt,
    });

    await new P5AuditService().log({
      userId: actorUserId ?? null,
      action: 'SAFETY_CALCULATE',
      entityType: 'MonthlyCycle',
      entityId: cycleId,
      cycleId,
      metadata: {
        sectors: sectorIds.length,
        participants: participants.length,
        rule: 'INDIVIDUAL_PER_OCCURRENCE_PLUS_AUTO_RECIDIVISM',
        scoringRuleVersion: 1,
        pillarCode: 'SAFETY',
      },
    });

    return {
      summary: {
        sectorsCalculated: sectorIds.length,
        participantsScored: participants.length,
        isPartial: true,
        calculatedPillars: [$Enums.PillarCode.SAFETY],
        pendingPillars,
      },
      employees: employeeScores,
    };
  }

  private prepareEmployeeScores(
    participants: Array<{
      id: string;
      employeeId: string;
      sectorId: string;
    }>,
    accidentsByEmployee: Map<
      string,
      Array<{ accidentType: $Enums.AccidentType }>
    >,
    withLeaveInd: SafetyIndicatorRef,
    withoutLeaveInd: SafetyIndicatorRef,
    frequencyInd: SafetyIndicatorRef,
  ): PreparedEmployeeScore[] {
    return participants.map((participant) => {
      const employeeAccidents =
        accidentsByEmployee.get(participant.employeeId) ?? [];
      const withLeaveCount = employeeAccidents.filter(
        (a) => a.accidentType === $Enums.AccidentType.WITH_LEAVE,
      ).length;
      const withoutLeaveCount = employeeAccidents.filter(
        (a) => a.accidentType === $Enums.AccidentType.WITHOUT_LEAVE,
      ).length;
      const score = buildEmployeeSafetyScore({
        withLeaveCount,
        withoutLeaveCount,
        withLeavePenalty: decimalToUnits(withLeaveInd.maxInternalPoints),
        withoutLeavePenalty: decimalToUnits(withoutLeaveInd.maxInternalPoints),
        frequencyPenalty: decimalToUnits(frequencyInd.maxInternalPoints),
      });
      return {
        participantId: participant.id,
        employeeId: participant.employeeId,
        sectorId: participant.sectorId,
        withLeaveCount,
        withoutLeaveCount,
        score,
      };
    });
  }

  private prepareEmployeeScoresV2(
    participants: Array<{
      id: string;
      employeeId: string;
      sectorId: string;
    }>,
    accidentsByEmployee: Map<
      string,
      Array<{ accidentType: $Enums.AccidentType }>
    >,
    config: ScoringConfigV2,
    factoryBalance: SafetyFactoryBalance,
  ): PreparedEmployeeScoreV2[] {
    return participants.map((participant) => {
      const employeeAccidents =
        accidentsByEmployee.get(participant.employeeId) ?? [];
      const withLeaveCount = employeeAccidents.filter(
        (a) => a.accidentType === $Enums.AccidentType.WITH_LEAVE,
      ).length;
      const withoutLeaveCount = employeeAccidents.filter(
        (a) => a.accidentType === $Enums.AccidentType.WITHOUT_LEAVE,
      ).length;
      const score = buildEmployeeSafetyScoreV2({
        config,
        withLeaveCount,
        withoutLeaveCount,
        factoryBalance,
      });
      return {
        participantId: participant.id,
        employeeId: participant.employeeId,
        sectorId: participant.sectorId,
        withLeaveCount,
        withoutLeaveCount,
        score,
      };
    });
  }

  private async persistPreparedScores(input: {
    cycleId: string;
    programYearId: string;
    prepared: PreparedEmployeeScore[];
    withLeaveInd: SafetyIndicatorRef;
    withoutLeaveInd: SafetyIndicatorRef;
    frequencyInd: SafetyIndicatorRef;
    safetyPillarId: string;
    calculatedAt: Date;
  }) {
    if (input.prepared.length === 0) return;

    const {
      cycleId,
      programYearId,
      prepared,
      withLeaveInd,
      withoutLeaveInd,
      frequencyInd,
      safetyPillarId,
      calculatedAt,
    } = input;

    // Full cycle: ~5 upserts/participante. Incremental: 1–2 pessoas, tx curta.
    const txTimeoutMs = Math.min(
      300_000,
      Math.max(15_000, prepared.length * 80),
    );

    await prisma.$transaction(
      async (tx) => {
        const resultRepo = new IndicatorResultPrismaRepository(tx);
        const pillarScoreRepo = new EmployeePillarScorePrismaRepository(tx);
        const chunkSize = 25;

        for (let i = 0; i < prepared.length; i += chunkSize) {
          const chunk = prepared.slice(i, i + chunkSize);
          await Promise.all(
            chunk.map(async (row) => {
              const { score, withLeaveCount, withoutLeaveCount } = row;
              const withLeavePreserved = Math.max(
                0,
                decimalToUnits(withLeaveInd.maxInternalPoints) -
                  score.withLeaveDeduction,
              );
              const withoutLeavePreserved = Math.max(
                0,
                decimalToUnits(withoutLeaveInd.maxInternalPoints) -
                  score.withoutLeaveDeduction,
              );
              const withLeaveWeightedCents =
                convertInternalToP5Cents(withLeavePreserved);
              const withoutLeaveWeightedCents = convertInternalToP5Cents(
                withoutLeavePreserved,
              );
              const frequencyWeightedCents = convertInternalToP5Cents(
                score.frequencyPreserved,
              );

              await resultRepo.upsert({
                cycleId,
                indicatorId: withLeaveInd.id,
                scope: $Enums.IndicatorScope.INDIVIDUAL,
                scopeKey: row.employeeId,
                sectorId: row.sectorId,
                employeeId: row.employeeId,
                rawValue: new Prisma.Decimal(withLeaveCount),
                targetValue: new Prisma.Decimal(0),
                preservedInternalPoints: new Prisma.Decimal(withLeavePreserved),
                weightedP5Points: decimalAsPrisma(withLeaveWeightedCents),
                status: $Enums.ResultStatus.PROVISIONAL,
                calculationDetails: {
                  indicatorCode: 'SAFETY_WITH_LEAVE',
                  scope: 'INDIVIDUAL',
                  employeeId: row.employeeId,
                  sectorId: row.sectorId,
                  validatedOccurrences: withLeaveCount,
                  penaltyPerOccurrence: decimalToUnits(
                    withLeaveInd.maxInternalPoints,
                  ),
                  deduction: score.withLeaveDeduction,
                  rule: 'PER_OCCURRENCE_DEDUCTION',
                  source: 'CIPA',
                  calculatedAt: calculatedAt.toISOString(),
                },
                calculatedAt,
              });

              await resultRepo.upsert({
                cycleId,
                indicatorId: withoutLeaveInd.id,
                scope: $Enums.IndicatorScope.INDIVIDUAL,
                scopeKey: row.employeeId,
                sectorId: row.sectorId,
                employeeId: row.employeeId,
                rawValue: new Prisma.Decimal(withoutLeaveCount),
                targetValue: new Prisma.Decimal(0),
                preservedInternalPoints: new Prisma.Decimal(
                  withoutLeavePreserved,
                ),
                weightedP5Points: decimalAsPrisma(withoutLeaveWeightedCents),
                status: $Enums.ResultStatus.PROVISIONAL,
                calculationDetails: {
                  indicatorCode: 'SAFETY_WITHOUT_LEAVE',
                  scope: 'INDIVIDUAL',
                  employeeId: row.employeeId,
                  sectorId: row.sectorId,
                  validatedOccurrences: withoutLeaveCount,
                  penaltyPerOccurrence: decimalToUnits(
                    withoutLeaveInd.maxInternalPoints,
                  ),
                  deduction: score.withoutLeaveDeduction,
                  rule: 'PER_OCCURRENCE_DEDUCTION',
                  source: 'CIPA',
                  calculatedAt: calculatedAt.toISOString(),
                },
                calculatedAt,
              });

              await resultRepo.upsert({
                cycleId,
                indicatorId: frequencyInd.id,
                scope: $Enums.IndicatorScope.INDIVIDUAL,
                scopeKey: row.employeeId,
                sectorId: row.sectorId,
                employeeId: row.employeeId,
                rawValue: new Prisma.Decimal(score.accidentCount),
                targetValue: new Prisma.Decimal(1),
                preservedInternalPoints: new Prisma.Decimal(
                  score.frequencyPreserved,
                ),
                weightedP5Points: decimalAsPrisma(frequencyWeightedCents),
                status: $Enums.ResultStatus.PROVISIONAL,
                calculationDetails: {
                  indicatorCode: 'SAFETY_FREQUENCY',
                  scope: 'INDIVIDUAL',
                  employeeId: row.employeeId,
                  sectorId: row.sectorId,
                  accidentCount: score.accidentCount,
                  isRecidivist: score.isRecidivist,
                  frequencyDeduction: score.frequencyDeduction,
                  rule: 'AUTO_RECIDIVISM_FROM_ACCIDENT_COUNT',
                  source: 'P5_INTERNAL',
                  calculatedAt: calculatedAt.toISOString(),
                },
                calculatedAt,
              });

              await pillarScoreRepo.upsert({
                participantId: row.participantId,
                pillarId: safetyPillarId,
                internalScore: new Prisma.Decimal(score.internalTotal),
                weightedPoints: decimalAsPrisma(score.weightedP5Cents),
                status: $Enums.ResultStatus.PROVISIONAL,
                calculationDetails: {
                  scoringRuleVersion: 1,
                  sectorId: row.sectorId,
                  withLeaveCount,
                  withoutLeaveCount,
                  accidentCount: score.accidentCount,
                  withLeaveDeduction: score.withLeaveDeduction,
                  withoutLeaveDeduction: score.withoutLeaveDeduction,
                  frequencyDeduction: score.frequencyDeduction,
                  frequencyPreserved: score.frequencyPreserved,
                  isRecidivist: score.isRecidivist,
                  rawInternal: score.rawInternal,
                  internalTotal: score.internalTotal,
                  weightedP5Cents: score.weightedP5Cents,
                  weightedP5: score.weightedP5,
                  floorAtZero: true,
                  isPartial: true,
                  calculatedAt: calculatedAt.toISOString(),
                },
                calculatedAt,
              });

              await rebuildParticipantMonthlyScore({
                tx,
                participantId: row.participantId,
                programYearId,
                calculatedAt,
              });
            }),
          );
        }
      },
      { maxWait: 20_000, timeout: txTimeoutMs },
    );
  }

  private async persistPreparedScoresV2(input: {
    cycleId: string;
    programYearId: string;
    prepared: PreparedEmployeeScoreV2[];
    config: ScoringConfigV2;
    factoryBalance: SafetyFactoryBalance;
    withLeaveInd: SafetyIndicatorRef;
    withoutLeaveInd: SafetyIndicatorRef;
    frequencyInd: SafetyIndicatorRef;
    safetyPillarId: string;
    calculatedAt: Date;
  }) {
    if (input.prepared.length === 0) return;

    const {
      cycleId,
      programYearId,
      prepared,
      config,
      factoryBalance,
      withLeaveInd,
      withoutLeaveInd,
      frequencyInd,
      safetyPillarId,
      calculatedAt,
    } = input;

    const txTimeoutMs = Math.min(
      300_000,
      Math.max(15_000, prepared.length * 80),
    );

    const factoryDeductionP5 = centsToNumber(
      factoryBalance.factoryDeductionCents,
    );
    const factoryBalanceP5 = centsToNumber(factoryBalance.factoryBalanceCents);

    await prisma.$transaction(
      async (tx) => {
        const resultRepo = new IndicatorResultPrismaRepository(tx);
        const pillarScoreRepo = new EmployeePillarScorePrismaRepository(tx);
        const chunkSize = 25;

        for (let i = 0; i < prepared.length; i += chunkSize) {
          const chunk = prepared.slice(i, i + chunkSize);
          await Promise.all(
            chunk.map(async (row) => {
              const { score, withLeaveCount, withoutLeaveCount } = row;
              const internalScoreCents = p5CentsToInternalScoreCents(
                score.weightedP5Cents,
              );

              await resultRepo.upsert({
                cycleId,
                indicatorId: withLeaveInd.id,
                scope: $Enums.IndicatorScope.INDIVIDUAL,
                scopeKey: row.employeeId,
                sectorId: row.sectorId,
                employeeId: row.employeeId,
                rawValue: new Prisma.Decimal(withLeaveCount),
                targetValue: new Prisma.Decimal(0),
                preservedInternalPoints: new Prisma.Decimal(0),
                weightedP5Points: decimalAsPrisma(0),
                status: $Enums.ResultStatus.PROVISIONAL,
                calculationDetails: {
                  indicatorCode: 'SAFETY_WITH_LEAVE',
                  scope: 'INDIVIDUAL',
                  scoringRuleVersion: 2,
                  employeeId: row.employeeId,
                  sectorId: row.sectorId,
                  validatedOccurrences: withLeaveCount,
                  factoryDeductionP5PerOccurrence:
                    config.safety.withLeave.factoryDeductionP5,
                  individualPenaltyP5PerOccurrence:
                    config.safety.withLeave.individualPenaltyP5,
                  rule: 'FACTORY_BALANCE_V2',
                  source: 'CIPA',
                  calculatedAt: calculatedAt.toISOString(),
                },
                calculatedAt,
              });

              await resultRepo.upsert({
                cycleId,
                indicatorId: withoutLeaveInd.id,
                scope: $Enums.IndicatorScope.INDIVIDUAL,
                scopeKey: row.employeeId,
                sectorId: row.sectorId,
                employeeId: row.employeeId,
                rawValue: new Prisma.Decimal(withoutLeaveCount),
                targetValue: new Prisma.Decimal(0),
                preservedInternalPoints: new Prisma.Decimal(0),
                weightedP5Points: decimalAsPrisma(0),
                status: $Enums.ResultStatus.PROVISIONAL,
                calculationDetails: {
                  indicatorCode: 'SAFETY_WITHOUT_LEAVE',
                  scope: 'INDIVIDUAL',
                  scoringRuleVersion: 2,
                  employeeId: row.employeeId,
                  sectorId: row.sectorId,
                  validatedOccurrences: withoutLeaveCount,
                  factoryDeductionP5PerOccurrence:
                    config.safety.withoutLeave.factoryDeductionP5,
                  individualPenaltyP5PerOccurrence:
                    config.safety.withoutLeave.individualPenaltyP5,
                  rule: 'FACTORY_BALANCE_V2',
                  source: 'CIPA',
                  calculatedAt: calculatedAt.toISOString(),
                },
                calculatedAt,
              });

              // FREQUENCY depreciado na v2: zera resultado residual legado.
              await resultRepo.upsert({
                cycleId,
                indicatorId: frequencyInd.id,
                scope: $Enums.IndicatorScope.INDIVIDUAL,
                scopeKey: row.employeeId,
                sectorId: row.sectorId,
                employeeId: row.employeeId,
                rawValue: new Prisma.Decimal(0),
                targetValue: new Prisma.Decimal(0),
                preservedInternalPoints: new Prisma.Decimal(0),
                weightedP5Points: decimalAsPrisma(0),
                status: $Enums.ResultStatus.PROVISIONAL,
                calculationDetails: {
                  indicatorCode: 'SAFETY_FREQUENCY',
                  scope: 'INDIVIDUAL',
                  scoringRuleVersion: 2,
                  deprecated: true,
                  note: 'Frequência/reincidência não se aplica na regra v2 (saldo coletivo + multa individual)',
                  employeeId: row.employeeId,
                  sectorId: row.sectorId,
                  rule: 'DEPRECATED_IN_V2',
                  source: 'P5_INTERNAL',
                  calculatedAt: calculatedAt.toISOString(),
                },
                calculatedAt,
              });

              await pillarScoreRepo.upsert({
                participantId: row.participantId,
                pillarId: safetyPillarId,
                internalScore: decimalAsPrisma(internalScoreCents),
                weightedPoints: decimalAsPrisma(score.weightedP5Cents),
                status: $Enums.ResultStatus.PROVISIONAL,
                calculationDetails: {
                  scoringRuleVersion: 2,
                  sectorId: row.sectorId,
                  withLeaveCount,
                  withoutLeaveCount,
                  factoryWithLeaveCount: factoryBalance.factoryWithLeaveCount,
                  factoryWithoutLeaveCount:
                    factoryBalance.factoryWithoutLeaveCount,
                  factoryDeductionP5,
                  factoryBalanceP5,
                  factoryZeroed: factoryBalance.factoryZeroed,
                  individualDeductionP5: centsToNumber(
                    score.individualDeductionCents,
                  ),
                  rawScoreP5: centsToNumber(score.rawScoreCents),
                  weightedP5Cents: score.weightedP5Cents,
                  weightedP5: score.weightedP5,
                  zeroedBy: score.zeroedBy,
                  zeroBelowPercent: score.zeroBelowPercent,
                  floorP5: centsToNumber(score.floorCents),
                  configSnapshot: {
                    globalZeroBelowPercent: config.globalZeroBelowPercent,
                    safety: config.safety,
                    safetyZeroBelowPercent: score.zeroBelowPercent,
                  },
                  isPartial: true,
                  calculatedAt: calculatedAt.toISOString(),
                },
                calculatedAt,
              });

              await rebuildParticipantMonthlyScore({
                tx,
                participantId: row.participantId,
                programYearId,
                calculatedAt,
              });
            }),
          );
        }
      },
      { maxWait: 20_000, timeout: txTimeoutMs },
    );
  }

  /**
   * Recalcula colaboradores atingidos.
   * Na v2 o desconto de fábrica afeta todos: recalcula o ciclo inteiro.
   */
  async recalculateEmployees(
    cycleId: string,
    employeeIds: string[],
    actorUserId?: string | null,
  ) {
    const uniqueIds = [...new Set(employeeIds.filter(Boolean))];
    if (uniqueIds.length === 0) return;

    markCycleRecalculating(cycleId);
    try {
      const cycleRepo = new MonthlyCyclePrismaRepository(prisma);
      const cycle = await cycleRepo.findById(cycleId);
      if (!cycle) throw new HttpError('Ciclo não encontrado', 404);

      if (
        cycle.status === $Enums.CycleStatus.HOMOLOGATED ||
        cycle.status === $Enums.CycleStatus.LOCKED
      ) {
        throw new HttpError(
          'Ciclo homologado ou bloqueado não permite novo cálculo',
          400,
        );
      }

      const scoringConfig = resolveCycleScoringConfig(cycle);
      if (isScoringConfigV2(scoringConfig)) {
        // Desconto coletivo: qualquer acidente exige recálculo de todos.
        await this.performCalculate(cycleId, actorUserId);
        return;
      }

      await this.syncRecidivismHistoryRows(cycleId, uniqueIds);

      const pillarRepo = new PillarConfigPrismaRepository(prisma);
      const safetyPillar = await pillarRepo.findByProgramYearAndCode(
        cycle.programYearId,
        $Enums.PillarCode.SAFETY,
      );
      if (!safetyPillar) {
        throw new HttpError('Pilar Segurança não configurado no programa', 400);
      }

      const pillarWithIndicators = await pillarRepo.findById(safetyPillar.id);
      if (!pillarWithIndicators) {
        throw new HttpError('Pilar Segurança não encontrado', 404);
      }

      const indicators = pillarWithIndicators.indicators.filter((i) => i.active);
      const withLeaveInd = indicators.find((i) => i.code === 'SAFETY_WITH_LEAVE');
      const withoutLeaveInd = indicators.find(
        (i) => i.code === 'SAFETY_WITHOUT_LEAVE',
      );
      const frequencyInd = indicators.find((i) => i.code === 'SAFETY_FREQUENCY');

      if (!withLeaveInd || !withoutLeaveInd || !frequencyInd) {
        throw new HttpError(
          'Indicadores de Segurança incompletos na configuração',
          400,
        );
      }

      const participants = await prisma.cycleParticipant.findMany({
        where: {
          cycleId,
          employeeId: { in: uniqueIds },
          activeInCycle: true,
        },
      });
      if (participants.length === 0) return;

      const validated = await prisma.safetyAccident.findMany({
        where: {
          cycleId,
          employeeId: { in: uniqueIds },
          status: $Enums.AccidentStatus.VALIDATED,
          accidentType: {
            in: [$Enums.AccidentType.WITH_LEAVE, $Enums.AccidentType.WITHOUT_LEAVE],
          },
        },
        select: { employeeId: true, accidentType: true },
      });

      const accidentsByEmployee = new Map<string, typeof validated>();
      for (const accident of validated) {
        if (!accident.employeeId) continue;
        const list = accidentsByEmployee.get(accident.employeeId) ?? [];
        list.push(accident);
        accidentsByEmployee.set(accident.employeeId, list);
      }

      const prepared = this.prepareEmployeeScores(
        participants,
        accidentsByEmployee,
        withLeaveInd,
        withoutLeaveInd,
        frequencyInd,
      );
      const calculatedAt = new Date();

      await this.persistPreparedScores({
        cycleId,
        programYearId: cycle.programYearId,
        prepared,
        withLeaveInd,
        withoutLeaveInd,
        frequencyInd,
        safetyPillarId: safetyPillar.id,
        calculatedAt,
      });

      await new P5AuditService().log({
        userId: actorUserId ?? null,
        action: 'SAFETY_CALCULATE',
        entityType: 'MonthlyCycle',
        entityId: cycleId,
        cycleId,
        metadata: {
          incremental: true,
          employees: uniqueIds.length,
          rule: 'INDIVIDUAL_PER_OCCURRENCE_PLUS_AUTO_RECIDIVISM',
          scoringRuleVersion: 1,
          pillarCode: 'SAFETY',
        },
      });
    } finally {
      clearCycleRecalculating(cycleId);
    }
  }

  /**
   * Recalcula Segurança após inserção/revisão de acidente (ou abertura do ciclo).
   * No-op se o ciclo estiver homologado/bloqueado ou sem participantes ativos.
   * Mantém o status (OPEN permanece OPEN) e atualiza calculatedAt.
   * Com employeeIds, recalcula só esses colaboradores.
   */
  async recalculateIfApplicable(
    cycleId: string,
    actorUserId?: string | null,
    employeeIds?: string[],
  ): Promise<boolean> {
    const cycleRepo = new MonthlyCyclePrismaRepository(prisma);
    const cycle = await cycleRepo.findById(cycleId);
    if (!cycle) return false;

    if (
      cycle.status === $Enums.CycleStatus.HOMOLOGATED ||
      cycle.status === $Enums.CycleStatus.LOCKED
    ) {
      return false;
    }

    const participants = await prisma.cycleParticipant.count({
      where: { cycleId, activeInCycle: true },
    });
    if (participants === 0) return false;

    if (employeeIds && employeeIds.length > 0) {
      await this.recalculateEmployees(cycleId, employeeIds, actorUserId);
    } else {
      await this.calculate(cycleId, actorUserId);
    }

    await cycleRepo.updateStatus(cycleId, {
      status: cycle.status,
      calculatedAt: new Date(),
    });

    return true;
  }

  async setFrequencyResult(_input: {
    cycleId: string;
    sectorId: string;
    preservedInternalPoints: number;
    actorUserId?: string | null;
  }) {
    throw new HttpError(
      'Frequência/reincidência é calculada automaticamente pelo P5 quando o colaborador tem 2+ acidentes (com ou sem afastamento) no ciclo. Não envie FREQUENCY pela CIPA.',
      400,
    );
  }

  async getResults(
    cycleId: string,
    options?: {
      page?: number;
      pageSize?: number;
      costCenter?: string;
    },
  ) {
    const cycleRepo = new MonthlyCyclePrismaRepository(prisma);
    const cycle = await cycleRepo.findById(cycleId);
    if (!cycle) throw new HttpError('Ciclo não encontrado', 404);

    const scoringConfig = resolveCycleScoringConfig(cycle);
    const useV2 = isScoringConfigV2(scoringConfig);
    const sectorNote = useV2 ? V2_SECTOR_NOTE : LEGACY_SECTOR_NOTE;

    const resultRepo = new IndicatorResultPrismaRepository(prisma);
    const results = await resultRepo.findByCycleId(cycleId);

    const participantRepo = new CycleParticipantPrismaRepository(prisma);
    const participants = await participantRepo.findActiveByCycleId(cycleId);

    const bySector = new Map<
      string,
      {
        sectorId: string;
        sectorName: string;
        costCenter: string | null;
        withLeave: number;
        withoutLeave: number;
        recidivismCount: number;
        internalTotalAvg: number;
        weightedP5Avg: number;
        participantsCount: number;
        note: string;
      }
    >();

    for (const p of participants) {
      const current = bySector.get(p.sectorId) ?? {
        sectorId: p.sectorId,
        sectorName: p.sector.name,
        costCenter: p.sector.code ?? null,
        withLeave: 0,
        withoutLeave: 0,
        recidivismCount: 0,
        internalTotalAvg: 0,
        weightedP5Avg: 0,
        participantsCount: 0,
        note: sectorNote,
      };
      current.participantsCount += 1;
      bySector.set(p.sectorId, current);
    }

    for (const r of results) {
      if (r.scope !== $Enums.IndicatorScope.INDIVIDUAL || !r.sectorId) continue;
      const bucket = bySector.get(r.sectorId);
      if (!bucket) continue;
      if (r.indicator.code === 'SAFETY_WITH_LEAVE') {
        bucket.withLeave += Number(r.rawValue ?? 0);
      } else if (r.indicator.code === 'SAFETY_WITHOUT_LEAVE') {
        bucket.withoutLeave += Number(r.rawValue ?? 0);
      }
    }

    const pillarScores = await prisma.employeePillarScore.findMany({
      where: {
        participantId: { in: participants.map((p) => p.id) },
      },
      include: { participant: true, pillar: true },
    });

    for (const sectorId of bySector.keys()) {
      const bucket = bySector.get(sectorId)!;
      const sectorParticipants = participants.filter(
        (p) => p.sectorId === sectorId,
      );
      const scores = pillarScores.filter(
        (ps) =>
          ps.pillar.code === $Enums.PillarCode.SAFETY &&
          sectorParticipants.some((p) => p.id === ps.participantId),
      );
      // Sem score calculado: preservação no máximo do pilar (não zerar a média).
      if (scores.length === 0) {
        bucket.internalTotalAvg = useV2
          ? SAFETY_P5_MAX_POINTS
          : SAFETY_INTERNAL_MAX;
        bucket.weightedP5Avg = SAFETY_P5_MAX_POINTS;
        bySector.set(sectorId, bucket);
        continue;
      }
      const internalCents = scores.map((s) => toCents(s.internalScore));
      const weightedCents = scores.map((s) => toCents(s.weightedPoints));
      const recidivismCount = useV2
        ? 0
        : scores.filter((s) => {
            const details = s.calculationDetails;
            return (
              details != null &&
              typeof details === 'object' &&
              'isRecidivist' in details &&
              Boolean((details as { isRecidivist: boolean }).isRecidivist)
            );
          }).length;
      bucket.internalTotalAvg = centsToNumber(averageCents(internalCents));
      bucket.weightedP5Avg = centsToNumber(averageCents(weightedCents));
      bucket.recidivismCount = recidivismCount;
      bySector.set(sectorId, bucket);
    }

    const accidentRepo = new SafetyAccidentPrismaRepository(prisma);
    const statusCounts = await accidentRepo.countByCycleAndStatus(cycleId);
    const counts: Record<string, number> = {};
    for (const g of statusCounts) {
      counts[g.status] = g._count._all;
    }

    const safetyPillarScores = pillarScores.filter(
      (ps) => ps.pillar.code === $Enums.PillarCode.SAFETY,
    );

    let factoryInternalAvg: number | null = null;
    let factoryWeightedP5Avg: number | null = null;

    if (useV2) {
      // Média da fábrica = saldo coletivo (não média dos indivíduos).
      const sampleDetails = safetyPillarScores.find(
        (s) =>
          s.calculationDetails != null &&
          typeof s.calculationDetails === 'object' &&
          'factoryBalanceP5' in (s.calculationDetails as object),
      )?.calculationDetails as Record<string, unknown> | undefined;

      if (sampleDetails && typeof sampleDetails.factoryBalanceP5 === 'number') {
        factoryWeightedP5Avg = sampleDetails.factoryZeroed
          ? 0
          : sampleDetails.factoryBalanceP5;
        factoryInternalAvg =
          factoryWeightedP5Avg == null
            ? null
            : centsToNumber(toCents(factoryWeightedP5Avg));
      } else if (safetyPillarScores.length === 0) {
        factoryInternalAvg = null;
        factoryWeightedP5Avg = null;
      } else {
        const validated = (
          await accidentRepo.findValidatedByCycleId(cycleId)
        ).filter((a) => isScoreableAccidentType(a.accidentType));
        const bal = computeSafetyFactoryBalance({
          config: scoringConfig,
          factoryWithLeaveCount: validated.filter(
            (a) => a.accidentType === $Enums.AccidentType.WITH_LEAVE,
          ).length,
          factoryWithoutLeaveCount: validated.filter(
            (a) => a.accidentType === $Enums.AccidentType.WITHOUT_LEAVE,
          ).length,
        });
        factoryWeightedP5Avg = centsToNumber(bal.factoryBalanceCents);
        factoryInternalAvg = centsToNumber(
          p5CentsToInternalScoreCents(bal.factoryBalanceCents),
        );
      }
    } else {
      factoryInternalAvg =
        safetyPillarScores.length === 0
          ? null
          : centsToNumber(
              averageCents(
                safetyPillarScores.map((s) => toCents(s.internalScore)),
              ),
            );
      factoryWeightedP5Avg =
        safetyPillarScores.length === 0
          ? null
          : centsToNumber(
              averageCents(
                safetyPillarScores.map((s) => toCents(s.weightedPoints)),
              ),
            );
    }

    const costCenterQuery = options?.costCenter?.trim().toLowerCase() ?? '';
    const allSectors = [...bySector.values()]
      .map((s) => ({
        sectorId: s.sectorId,
        sectorName: s.sectorName,
        costCenter: s.costCenter,
        withLeave: s.withLeave,
        withoutLeave: s.withoutLeave,
        frequencyInternal: s.recidivismCount,
        frequencyPending: false,
        internalTotal: s.internalTotalAvg,
        weightedP5: s.weightedP5Avg,
        participantsCount: s.participantsCount,
        note: s.note,
      }))
      .filter((s) =>
        !costCenterQuery
          ? true
          : (s.costCenter ?? '').toLowerCase().includes(costCenterQuery),
      )
      .sort((a, b) => a.weightedP5 - b.weightedP5);

    const paginate = options?.page != null;
    const pageSize = paginate
      ? Math.min(Math.max(options?.pageSize ?? 10, 1), 10)
      : allSectors.length || 1;
    const totalItems = allSectors.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);
    const page = paginate
      ? Math.min(Math.max(options!.page!, 1), totalPages)
      : 1;
    const sectors = paginate
      ? allSectors.slice((page - 1) * pageSize, page * pageSize)
      : allSectors;

    return {
      isPartial: true,
      calculatedPillars: [$Enums.PillarCode.SAFETY],
      pendingPillars: [
        $Enums.PillarCode.PRODUCTIVITY,
        $Enums.PillarCode.QUALITY_5S,
        $Enums.PillarCode.ABSENTEEISM,
        $Enums.PillarCode.REVENUE,
      ],
      accidentCounts: {
        pending: counts.PENDING_REVIEW ?? 0,
        validated: counts.VALIDATED ?? 0,
        rejected: counts.REJECTED ?? 0,
        imported: counts.IMPORTED ?? 0,
        cancelled: counts.CANCELLED ?? 0,
      },
      factoryInternalAvg,
      factoryWeightedP5Avg,
      scoringRuleVersion: useV2 ? 2 : 1,
      recalculating: isCycleRecalculating(cycleId),
      sectors,
      ...(paginate
        ? {
            pagination: {
              page,
              pageSize,
              totalItems,
              totalPages,
            },
          }
        : {}),
      indicatorResults: results.map((r) => ({
        id: r.id,
        indicatorCode: r.indicator.code,
        indicatorName: r.indicator.name,
        scope: r.scope,
        scopeKey: r.scopeKey,
        sectorId: r.sectorId,
        sectorName: r.sector?.name ?? null,
        employeeId: r.employeeId,
        rawValue: r.rawValue == null ? null : centsToNumber(toCents(r.rawValue)),
        preservedInternalPoints: centsToNumber(
          toCents(r.preservedInternalPoints),
        ),
        weightedP5Points: centsToNumber(toCents(r.weightedP5Points)),
        status: r.status,
        calculationDetails: r.calculationDetails,
        calculatedAt: r.calculatedAt.toISOString(),
      })),
    };
  }

  private pointsLostForAccident(
    accidentType: $Enums.AccidentType,
    scoringConfig: ReturnType<typeof parseScoringConfig>,
  ): number {
    if (isScoringConfigV2(scoringConfig)) {
      if (accidentType === $Enums.AccidentType.WITH_LEAVE) {
        return scoringConfig.safety.withLeave.individualPenaltyP5;
      }
      if (accidentType === $Enums.AccidentType.WITHOUT_LEAVE) {
        return scoringConfig.safety.withoutLeave.individualPenaltyP5;
      }
      // FREQUENCY depreciado na v2
      return 0;
    }
    if (accidentType === $Enums.AccidentType.WITH_LEAVE) {
      return SAFETY_WITH_LEAVE_PENALTY;
    }
    if (accidentType === $Enums.AccidentType.WITHOUT_LEAVE) {
      return SAFETY_WITHOUT_LEAVE_PENALTY;
    }
    if (accidentType === $Enums.AccidentType.FREQUENCY) {
      return SAFETY_FREQUENCY_PENALTY;
    }
    return 0;
  }

  async getSectorDetail(
    cycleId: string,
    sectorId: string,
    options?: { page?: number; pageSize?: number },
  ) {
    const cycleRepo = new MonthlyCyclePrismaRepository(prisma);
    const cycle = await cycleRepo.findById(cycleId);
    if (!cycle) throw new HttpError('Ciclo não encontrado', 404);

    const scoringConfig = resolveCycleScoringConfig(cycle);
    const useV2 = isScoringConfigV2(scoringConfig);

    const participantRepo = new CycleParticipantPrismaRepository(prisma);
    const participants = (
      await participantRepo.findActiveByCycleId(cycleId)
    ).filter((p) => p.sectorId === sectorId);

    if (participants.length === 0) {
      throw new HttpError('Setor sem participantes ativos neste ciclo', 404);
    }

    const pillarScores = await prisma.employeePillarScore.findMany({
      where: {
        participantId: { in: participants.map((p) => p.id) },
        pillar: { code: $Enums.PillarCode.SAFETY },
      },
    });
    const scoreByParticipant = new Map(
      pillarScores.map((s) => [s.participantId, s]),
    );

    const allEmployees = participants
      .map((p) =>
        mapSafetyEmployeeLossDetail(p, scoreByParticipant.get(p.id) ?? null, {
          forceV2: useV2,
          ...(useV2 ? { config: scoringConfig } : {}),
        }),
      )
      .sort((a, b) => {
        const scoreA = a.weightedP5 ?? Number.POSITIVE_INFINITY;
        const scoreB = b.weightedP5 ?? Number.POSITIVE_INFINITY;
        return (
          scoreA - scoreB ||
          a.name.localeCompare(b.name, 'pt-BR')
        );
      });

    const sector = participants[0]!.sector;
    const scored = allEmployees.filter((e) => e.weightedP5 != null);
    const avgWeighted =
      scored.length === 0
        ? 0
        : centsToNumber(
            averageCents(scored.map((e) => toCents(e.weightedP5!))),
          );
    const avgInternal =
      scored.length === 0
        ? 0
        : centsToNumber(
            averageCents(scored.map((e) => toCents(e.internalScore!))),
          );

    const pageSize = Math.min(Math.max(options?.pageSize ?? 10, 1), 10);
    const totalItems = allEmployees.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const page = Math.min(Math.max(options?.page ?? 1, 1), totalPages);
    const employees = allEmployees.slice(
      (page - 1) * pageSize,
      page * pageSize,
    );

    if (!useV2) {
      // Garante linha de reincidência no histórico antes de listar (legado).
      await this.syncRecidivismHistoryRows(cycleId);
    }

    const nameByEmployeeId = new Map(
      participants.map((p) => [p.employeeId, p.employeeNameSnapshot]),
    );

    const accidentRows = await prisma.safetyAccident.findMany({
      where: {
        cycleId,
        sectorId,
        status: {
          notIn: [
            $Enums.AccidentStatus.CANCELLED,
            $Enums.AccidentStatus.REJECTED,
          ],
        },
      },
      include: { employee: true },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });

    const occurrences = accidentRows.map((row) => {
      const pointsLost = this.pointsLostForAccident(
        row.accidentType,
        scoringConfig,
      );

      const employeeName =
        (row.employeeId
          ? nameByEmployeeId.get(row.employeeId)
          : undefined) ??
        row.employee?.name ??
        '—';

      return {
        id: row.id,
        accidentType: row.accidentType,
        occurredAt: row.occurredAt.toISOString(),
        daysAway: row.daysAway,
        description: row.description,
        status: row.status,
        pointsLost,
        employeeName,
      };
    });

    return {
      cycle: {
        id: cycle.id,
        month: cycle.month,
        year: cycle.year,
        status: cycle.status,
      },
      sector: {
        sectorId,
        sectorName: sector.name,
        costCenter: sector.code ?? null,
        participantsCount: allEmployees.length,
        withLeave: allEmployees.reduce((acc, e) => acc + e.withLeave, 0),
        withoutLeave: allEmployees.reduce(
          (acc, e) => acc + e.withoutLeave,
          0,
        ),
        recidivismCount: useV2
          ? 0
          : allEmployees.filter((e) => e.isRecidivist).length,
        internalAvg: avgInternal,
        weightedP5Avg: avgWeighted,
      },
      employees,
      occurrences,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  async getParticipantDetail(cycleId: string, participantId: string) {
    const cycleRepo = new MonthlyCyclePrismaRepository(prisma);
    const cycle = await cycleRepo.findById(cycleId);
    if (!cycle) throw new HttpError('Ciclo não encontrado', 404);

    const scoringConfig = resolveCycleScoringConfig(cycle);
    const useV2 = isScoringConfigV2(scoringConfig);

    const participant = await prisma.cycleParticipant.findFirst({
      where: { id: participantId, cycleId },
      include: { employee: true, sector: true },
    });
    if (!participant) {
      throw new HttpError('Participante não encontrado neste ciclo', 404);
    }

    const score = await prisma.employeePillarScore.findFirst({
      where: {
        participantId,
        pillar: { code: $Enums.PillarCode.SAFETY },
      },
    });

    if (!useV2) {
      // Garante linha de reincidência no histórico antes de listar (legado).
      await this.syncRecidivismHistoryRows(cycleId);
    }

    const accidentRows = await prisma.safetyAccident.findMany({
      where: {
        cycleId,
        employeeId: participant.employeeId,
        status: {
          notIn: [
            $Enums.AccidentStatus.CANCELLED,
            $Enums.AccidentStatus.REJECTED,
          ],
        },
      },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });

    const occurrences = accidentRows.map((row) => {
      const pointsLost = this.pointsLostForAccident(
        row.accidentType,
        scoringConfig,
      );

      return {
        id: row.id,
        accidentType: row.accidentType,
        occurredAt: row.occurredAt.toISOString(),
        daysAway: row.daysAway,
        description: row.description,
        status: row.status,
        pointsLost,
      };
    });

    return {
      cycle: {
        id: cycle.id,
        month: cycle.month,
        year: cycle.year,
        status: cycle.status,
      },
      employee: mapSafetyEmployeeLossDetail(participant, score, {
        forceV2: useV2,
        ...(useV2 ? { config: scoringConfig } : {}),
      }),
      occurrences,
    };
  }
}
