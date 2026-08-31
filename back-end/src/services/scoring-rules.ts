import {
  ABSENTEEISM_P5_MAX,
  DEFAULT_ABSENTEEISM_FACTORY_DEDUCTION_P5,
  DEFAULT_ABSENTEEISM_INDIVIDUAL_PENALTY_P5,
} from '../constants/absenteeism-scoring.js';
import { $Enums } from '../generated/prisma/client.js';
import {
  centsToNumber,
  divFloor,
  intUnitsToCents,
  toCents,
} from '../lib/fixed-point.js';

/** Máximo P5 do pilar Segurança (evita import circular com safety-calculation). */
export const SAFETY_P5_MAX_POINTS = 20;

export const SCORING_CONFIG_VERSION = 2 as const;
export const DEFAULT_ZERO_BELOW_PERCENT = 70;
export const DEFAULT_SAFETY_INDIVIDUAL_PENALTY_P5 = 20;
export const DEFAULT_SAFETY_FACTORY_DEDUCTION_P5 = 2.06;

export type PillarCodeString =
  | 'SAFETY'
  | 'PRODUCTIVITY'
  | 'QUALITY_5S'
  | 'ABSENTEEISM'
  | 'REVENUE';

export type AccidentTypePenaltyConfig = {
  individualPenaltyP5: number;
  factoryDeductionP5: number;
};

export type ScoringConfigV2 = {
  version: 2;
  globalZeroBelowPercent: number;
  pillars: Record<PillarCodeString, { zeroBelowPercent: number | null }>;
  safety: {
    withLeave: AccidentTypePenaltyConfig;
    withoutLeave: AccidentTypePenaltyConfig;
  };
  absenteeism: AccidentTypePenaltyConfig;
};

export type ScoringConfigV1Legacy = {
  version: 1;
  legacy: true;
  rule: string;
  safety: {
    withLeaveInternalPenalty: number;
    withoutLeaveInternalPenalty: number;
    frequencyInternalPenalty: number;
    note: string;
  };
};

export type ScoringConfig = ScoringConfigV2 | ScoringConfigV1Legacy;

const PILLAR_CODES: PillarCodeString[] = [
  'SAFETY',
  'PRODUCTIVITY',
  'QUALITY_5S',
  'ABSENTEEISM',
  'REVENUE',
];

function defaultPillars(): ScoringConfigV2['pillars'] {
  return {
    SAFETY: { zeroBelowPercent: null },
    PRODUCTIVITY: { zeroBelowPercent: null },
    QUALITY_5S: { zeroBelowPercent: null },
    ABSENTEEISM: { zeroBelowPercent: null },
    REVENUE: { zeroBelowPercent: null },
  };
}

/** Template padrão v2 (painel / próximo ciclo). */
export function defaultScoringConfigV2(): ScoringConfigV2 {
  return {
    version: SCORING_CONFIG_VERSION,
    globalZeroBelowPercent: DEFAULT_ZERO_BELOW_PERCENT,
    pillars: defaultPillars(),
    safety: {
      withLeave: {
        individualPenaltyP5: DEFAULT_SAFETY_INDIVIDUAL_PENALTY_P5,
        factoryDeductionP5: DEFAULT_SAFETY_FACTORY_DEDUCTION_P5,
      },
      withoutLeave: {
        individualPenaltyP5: DEFAULT_SAFETY_INDIVIDUAL_PENALTY_P5,
        factoryDeductionP5: DEFAULT_SAFETY_FACTORY_DEDUCTION_P5,
      },
    },
    absenteeism: {
      individualPenaltyP5: DEFAULT_ABSENTEEISM_INDIVIDUAL_PENALTY_P5,
      factoryDeductionP5: DEFAULT_ABSENTEEISM_FACTORY_DEDUCTION_P5,
    },
  };
}

/** Snapshot legado para ciclos já fechados (somente auditoria). */
export function legacyScoringConfigV1(): ScoringConfigV1Legacy {
  return {
    version: 1,
    legacy: true,
    rule: 'INDIVIDUAL_PER_OCCURRENCE_PLUS_AUTO_RECIDIVISM',
    safety: {
      withLeaveInternalPenalty: 50,
      withoutLeaveInternalPenalty: 30,
      frequencyInternalPenalty: 20,
      note: 'Regra legada: descontos internos 50/30/20 no colaborador; sem perda coletiva de fábrica nem limiar de 70%.',
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePenalty(
  raw: unknown,
  fallback: AccidentTypePenaltyConfig,
  maxPoints: number,
): AccidentTypePenaltyConfig {
  if (!isRecord(raw)) return { ...fallback };
  const individual =
    typeof raw.individualPenaltyP5 === 'number' && Number.isFinite(raw.individualPenaltyP5)
      ? centsToNumber(toCents(raw.individualPenaltyP5))
      : fallback.individualPenaltyP5;
  const factory =
    typeof raw.factoryDeductionP5 === 'number' && Number.isFinite(raw.factoryDeductionP5)
      ? centsToNumber(toCents(raw.factoryDeductionP5))
      : fallback.factoryDeductionP5;
  return {
    individualPenaltyP5: Math.min(maxPoints, Math.max(0, individual)),
    factoryDeductionP5: Math.min(maxPoints, Math.max(0, factory)),
  };
}

/** Normaliza JSON desconhecido para ScoringConfig (v1 ou v2). */
export function parseScoringConfig(raw: unknown): ScoringConfig {
  if (!isRecord(raw)) return defaultScoringConfigV2();

  if (raw.version === 1 || raw.legacy === true) {
    const safety = isRecord(raw.safety) ? raw.safety : {};
    return {
      version: 1,
      legacy: true,
      rule:
        typeof raw.rule === 'string'
          ? raw.rule
          : 'INDIVIDUAL_PER_OCCURRENCE_PLUS_AUTO_RECIDIVISM',
      safety: {
        withLeaveInternalPenalty:
          typeof safety.withLeaveInternalPenalty === 'number'
            ? safety.withLeaveInternalPenalty
            : 50,
        withoutLeaveInternalPenalty:
          typeof safety.withoutLeaveInternalPenalty === 'number'
            ? safety.withoutLeaveInternalPenalty
            : 30,
        frequencyInternalPenalty:
          typeof safety.frequencyInternalPenalty === 'number'
            ? safety.frequencyInternalPenalty
            : 20,
        note:
          typeof safety.note === 'string'
            ? safety.note
            : legacyScoringConfigV1().safety.note,
      },
    };
  }

  const defaults = defaultScoringConfigV2();
  const globalZero =
    typeof raw.globalZeroBelowPercent === 'number' &&
    Number.isFinite(raw.globalZeroBelowPercent)
      ? Math.min(100, Math.max(0, Math.trunc(raw.globalZeroBelowPercent)))
      : defaults.globalZeroBelowPercent;

  const pillarsRaw = isRecord(raw.pillars) ? raw.pillars : {};
  const pillars = defaultPillars();
  for (const code of PILLAR_CODES) {
    const entry = pillarsRaw[code];
    if (isRecord(entry)) {
      const pct = entry.zeroBelowPercent;
      pillars[code] = {
        zeroBelowPercent:
          pct === null || pct === undefined
            ? null
            : typeof pct === 'number' && Number.isFinite(pct)
              ? Math.min(100, Math.max(0, Math.trunc(pct)))
              : null,
      };
    }
  }

  const safetyRaw = isRecord(raw.safety) ? raw.safety : {};
  return {
    version: 2,
    globalZeroBelowPercent: globalZero,
    pillars,
    safety: {
      withLeave: parsePenalty(
        safetyRaw.withLeave,
        defaults.safety.withLeave,
        SAFETY_P5_MAX_POINTS,
      ),
      withoutLeave: parsePenalty(
        safetyRaw.withoutLeave,
        defaults.safety.withoutLeave,
        SAFETY_P5_MAX_POINTS,
      ),
    },
    absenteeism: parsePenalty(
      raw.absenteeism,
      defaults.absenteeism,
      ABSENTEEISM_P5_MAX,
    ),
  };
}

export function isScoringConfigV2(config: ScoringConfig): config is ScoringConfigV2 {
  return config.version === 2;
}

/** Percentual efetivo do limiar para um pilar (override ou global). */
export function resolveZeroBelowPercent(
  config: ScoringConfigV2,
  pillarCode: PillarCodeString | $Enums.PillarCode,
): number {
  const code = pillarCode as PillarCodeString;
  const override = config.pillars[code]?.zeroBelowPercent;
  if (override === null || override === undefined) {
    return config.globalZeroBelowPercent;
  }
  return override;
}

/**
 * Piso em centésimos: floor(max * percent / 100).
 * Ex.: 20 P5 @ 70% → 1400 (14.00). Abaixo disso zera; exatamente no piso mantém.
 */
export function thresholdFloorCents(
  maxPointsUnits: number,
  zeroBelowPercent: number,
): number {
  const maxCents = toCents(maxPointsUnits);
  const pct = Math.min(100, Math.max(0, Math.trunc(zeroBelowPercent)));
  return divFloor(maxCents * pct, 100);
}

/** Zera se scoreCents < piso; exatamente no piso NÃO zera. */
export function applyZeroBelowThresholdCents(
  scoreCents: number,
  maxPointsUnits: number,
  zeroBelowPercent: number,
): { scoreCents: number; zeroed: boolean; floorCents: number } {
  const floorCents = thresholdFloorCents(maxPointsUnits, zeroBelowPercent);
  if (scoreCents < floorCents) {
    return { scoreCents: 0, zeroed: true, floorCents };
  }
  return { scoreCents, zeroed: false, floorCents };
}

/**
 * Quantas ocorrências iguais são necessárias para o saldo coletivo
 * ficar estritamente abaixo do limiar.
 * ceil((max − piso + 1 cêntimo) / perda).
 */
export function occurrencesToZero(
  maxPointsUnits: number,
  zeroBelowPercent: number,
  factoryDeductionP5: number,
): number {
  const deductionCents = toCents(factoryDeductionP5);
  if (deductionCents <= 0) return Number.POSITIVE_INFINITY;
  const maxCents = toCents(maxPointsUnits);
  const floorCents = thresholdFloorCents(maxPointsUnits, zeroBelowPercent);
  const needDrop = maxCents - floorCents + 1;
  return Math.ceil(needDrop / deductionCents);
}

/**
 * Perda mínima por ocorrência para N ocorrências zerarem o pilar (estritamente abaixo do limiar).
 * Ex.: 20 / 70% / N=4 → 1.51.
 */
export function deductionFromOccurrences(
  maxPointsUnits: number,
  zeroBelowPercent: number,
  occurrences: number,
): number {
  const n = Math.trunc(occurrences);
  if (n <= 0) return 0;
  const maxCents = toCents(maxPointsUnits);
  const floorCents = thresholdFloorCents(maxPointsUnits, zeroBelowPercent);
  const needDrop = maxCents - floorCents + 1;
  const perOccurrence = Math.ceil(needDrop / n);
  return centsToNumber(perOccurrence);
}

export type SafetyFactoryBalance = {
  factoryWithLeaveCount: number;
  factoryWithoutLeaveCount: number;
  factoryDeductionCents: number;
  factoryBalanceCents: number;
  factoryZeroed: boolean;
  floorCents: number;
  zeroBelowPercent: number;
  maxPoints: number;
};

/** Saldo coletivo da fábrica em Segurança (centésimos P5). */
export function computeSafetyFactoryBalance(input: {
  config: ScoringConfigV2;
  factoryWithLeaveCount: number;
  factoryWithoutLeaveCount: number;
  maxPoints?: number;
}): SafetyFactoryBalance {
  const maxPoints = input.maxPoints ?? SAFETY_P5_MAX_POINTS;
  const zeroBelowPercent = resolveZeroBelowPercent(input.config, 'SAFETY');
  const floorCents = thresholdFloorCents(maxPoints, zeroBelowPercent);
  const withLeave = Math.max(0, input.factoryWithLeaveCount);
  const withoutLeave = Math.max(0, input.factoryWithoutLeaveCount);
  const factoryDeductionCents =
    withLeave * toCents(input.config.safety.withLeave.factoryDeductionP5) +
    withoutLeave * toCents(input.config.safety.withoutLeave.factoryDeductionP5);
  const rawBalance = intUnitsToCents(maxPoints) - factoryDeductionCents;
  const factoryBalanceCents = Math.max(0, rawBalance);
  const factoryZeroed = factoryBalanceCents < floorCents;

  return {
    factoryWithLeaveCount: withLeave,
    factoryWithoutLeaveCount: withoutLeave,
    factoryDeductionCents,
    factoryBalanceCents: factoryZeroed ? 0 : factoryBalanceCents,
    factoryZeroed,
    floorCents,
    zeroBelowPercent,
    maxPoints,
  };
}

export type SafetyEmployeeScoreV2 = {
  withLeaveCount: number;
  withoutLeaveCount: number;
  individualDeductionCents: number;
  factoryDeductionCents: number;
  factoryBalanceCents: number;
  factoryZeroed: boolean;
  rawScoreCents: number;
  weightedP5Cents: number;
  weightedP5: number;
  zeroedBy: 'factory_threshold' | 'individual_threshold' | null;
  floorCents: number;
  zeroBelowPercent: number;
};

/**
 * Pontuação individual v2: saldo fábrica − perdas individuais da vítima,
 * depois limiar de 70% (ou override).
 */
export function buildEmployeeSafetyScoreV2(input: {
  config: ScoringConfigV2;
  withLeaveCount: number;
  withoutLeaveCount: number;
  factoryBalance: SafetyFactoryBalance;
}): SafetyEmployeeScoreV2 {
  const withLeaveCount = Math.max(0, input.withLeaveCount);
  const withoutLeaveCount = Math.max(0, input.withoutLeaveCount);
  const { factoryBalance, config } = input;

  if (factoryBalance.factoryZeroed) {
    const individualDeductionCents =
      withLeaveCount * toCents(config.safety.withLeave.individualPenaltyP5) +
      withoutLeaveCount *
        toCents(config.safety.withoutLeave.individualPenaltyP5);
    return {
      withLeaveCount,
      withoutLeaveCount,
      individualDeductionCents,
      factoryDeductionCents: factoryBalance.factoryDeductionCents,
      factoryBalanceCents: 0,
      factoryZeroed: true,
      rawScoreCents: 0,
      weightedP5Cents: 0,
      weightedP5: 0,
      zeroedBy: 'factory_threshold',
      floorCents: factoryBalance.floorCents,
      zeroBelowPercent: factoryBalance.zeroBelowPercent,
    };
  }

  const individualDeductionCents =
    withLeaveCount * toCents(config.safety.withLeave.individualPenaltyP5) +
    withoutLeaveCount * toCents(config.safety.withoutLeave.individualPenaltyP5);

  const rawScoreCents = Math.max(
    0,
    factoryBalance.factoryBalanceCents - individualDeductionCents,
  );
  const applied = applyZeroBelowThresholdCents(
    rawScoreCents,
    factoryBalance.maxPoints,
    factoryBalance.zeroBelowPercent,
  );

  return {
    withLeaveCount,
    withoutLeaveCount,
    individualDeductionCents,
    factoryDeductionCents: factoryBalance.factoryDeductionCents,
    factoryBalanceCents: factoryBalance.factoryBalanceCents,
    factoryZeroed: false,
    rawScoreCents,
    weightedP5Cents: applied.scoreCents,
    weightedP5: centsToNumber(applied.scoreCents),
    zeroedBy: applied.zeroed ? 'individual_threshold' : null,
    floorCents: applied.floorCents,
    zeroBelowPercent: factoryBalance.zeroBelowPercent,
  };
}

/** Filtra limiares de pilares para RESPONSIBLE (só os permitidos). */
export function scopeScoringConfigForViewer(
  config: ScoringConfig,
  allowedPillarCodes: PillarCodeString[] | null,
): ScoringConfig {
  if (allowedPillarCodes === null) return config;
  if (!isScoringConfigV2(config)) return config;

  const pillars = { ...defaultPillars() };
  for (const code of PILLAR_CODES) {
    if (allowedPillarCodes.includes(code)) {
      pillars[code] = config.pillars[code];
    } else {
      delete (pillars as Record<string, unknown>)[code];
    }
  }

  const canSeeSafety = allowedPillarCodes.includes('SAFETY');
  const canSeeAbsenteeism = allowedPillarCodes.includes('ABSENTEEISM');
  return {
    version: 2,
    globalZeroBelowPercent: config.globalZeroBelowPercent,
    pillars: pillars as ScoringConfigV2['pillars'],
    ...(canSeeSafety
      ? { safety: config.safety }
      : {
          safety: {
            withLeave: { individualPenaltyP5: 0, factoryDeductionP5: 0 },
            withoutLeave: { individualPenaltyP5: 0, factoryDeductionP5: 0 },
          },
        }),
    absenteeism: canSeeAbsenteeism
      ? config.absenteeism
      : { individualPenaltyP5: 0, factoryDeductionP5: 0 },
  };
}

/** Valida e normaliza payload do PUT do painel. */
export function normalizeScoringConfigInput(raw: unknown): ScoringConfigV2 {
  const parsed = parseScoringConfig(raw);
  if (!isScoringConfigV2(parsed)) {
    return defaultScoringConfigV2();
  }
  if (
    parsed.globalZeroBelowPercent < 0 ||
    parsed.globalZeroBelowPercent > 100
  ) {
    parsed.globalZeroBelowPercent = DEFAULT_ZERO_BELOW_PERCENT;
  }
  return parsed;
}
