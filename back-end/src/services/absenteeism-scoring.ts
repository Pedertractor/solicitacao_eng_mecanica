import {
  ABSENTEEISM_INDEX_THRESHOLD,
  ABSENTEEISM_INDIVIDUAL_POINTS,
  ABSENTEEISM_INTERNAL_MAX,
  ABSENTEEISM_P5_MAX,
  ABSENTEEISM_PARTIAL_DEDUCTION_WARNING,
  ABSENTEEISM_SECTOR_PLACEHOLDER,
} from '../constants/absenteeism-scoring.js';
import {
  averageCents,
  centsToNumber,
  divFloor,
  intUnitsToCents,
  toCents,
} from '../lib/fixed-point.js';
import {
  applyZeroBelowThresholdCents,
  defaultScoringConfigV2,
  isScoringConfigV2,
  resolveZeroBelowPercent,
  thresholdFloorCents,
  type ScoringConfig,
  type ScoringConfigV2,
} from './scoring-rules.js';

export function isAbsenteeismFactoryOccurrence(
  absenteeism: number | null,
): boolean {
  return absenteeism !== null && absenteeism < ABSENTEEISM_INDEX_THRESHOLD;
}

export function countAbsenteeismFactoryOccurrences(
  indices: readonly (number | null)[],
): number {
  return indices.filter(isAbsenteeismFactoryOccurrence).length;
}

export function resolveAbsenteeismScoringConfig(
  config: ScoringConfig | null | undefined,
): ScoringConfigV2 {
  if (config && isScoringConfigV2(config)) return config;
  return defaultScoringConfigV2();
}

export function weightedP5CentsToInternalUnits(weightedP5Cents: number): number {
  return centsToNumber(
    divFloor(weightedP5Cents * ABSENTEEISM_INTERNAL_MAX, ABSENTEEISM_P5_MAX),
  );
}

export type AbsenteeismFactoryBalance = {
  factoryOccurrenceCount: number;
  factoryDeductionCents: number;
  factoryBalanceCents: number;
  factoryZeroed: boolean;
  floorCents: number;
  zeroBelowPercent: number;
  maxPoints: number;
};

/** Saldo coletivo da fábrica em Absenteísmo (centésimos P5). */
export function computeAbsenteeismFactoryBalance(input: {
  config: ScoringConfigV2;
  factoryOccurrenceCount: number;
  maxPoints?: number;
}): AbsenteeismFactoryBalance {
  const maxPoints = input.maxPoints ?? ABSENTEEISM_P5_MAX;
  const zeroBelowPercent = resolveZeroBelowPercent(input.config, 'ABSENTEEISM');
  const floorCents = thresholdFloorCents(maxPoints, zeroBelowPercent);
  const count = Math.max(0, input.factoryOccurrenceCount);
  const factoryDeductionCents =
    count * toCents(input.config.absenteeism.factoryDeductionP5);
  const rawBalance = intUnitsToCents(maxPoints) - factoryDeductionCents;
  const factoryBalanceCents = Math.max(0, rawBalance);
  const factoryZeroed = factoryBalanceCents < floorCents;

  return {
    factoryOccurrenceCount: count,
    factoryDeductionCents,
    factoryBalanceCents: factoryZeroed ? 0 : factoryBalanceCents,
    factoryZeroed,
    floorCents,
    zeroBelowPercent,
    maxPoints,
  };
}

export type AbsenteeismEmployeeScore = {
  /** null = colaborador ausente na procedure (sem penalidade individual). */
  absenteeism: number | null;
  scoringRuleVersion: 2;
  individualPreserved: number;
  sectorPreserved: number;
  internalTotal: number;
  weightedP5Cents: number;
  weightedP5: number;
  individualDeducted: boolean;
  factoryOccurrenceCount: number;
  factoryDeductionP5: number;
  factoryBalanceP5: number;
  individualDeductionP5: number;
  factoryZeroed: boolean;
  zeroedBy: 'factory_threshold' | 'individual_threshold' | null;
  /** True se o piso de % do painel zerou o pilar neste mês. */
  zeroedByThreshold: boolean;
  zeroBelowPercent: number;
  floorP5: number;
};

/**
 * Pontuação individual v2: saldo fábrica − perda individual de quem ficou < 100,
 * depois limiar do painel.
 */
export function buildAbsenteeismEmployeeScore(input: {
  absenteeism: number | null;
  config: ScoringConfigV2;
  factoryBalance: AbsenteeismFactoryBalance;
}): AbsenteeismEmployeeScore {
  const { factoryBalance, config, absenteeism } = input;
  const occurred = isAbsenteeismFactoryOccurrence(absenteeism);
  const individualDeductionCents = occurred
    ? toCents(config.absenteeism.individualPenaltyP5)
    : 0;
  const individualDeductionP5 = centsToNumber(individualDeductionCents);
  const factoryDeductionP5 = centsToNumber(factoryBalance.factoryDeductionCents);
  const factoryBalanceP5 = centsToNumber(factoryBalance.factoryBalanceCents);
  const floorP5 = centsToNumber(factoryBalance.floorCents);
  const individualPreserved = occurred ? 0 : ABSENTEEISM_INDIVIDUAL_POINTS;

  if (factoryBalance.factoryZeroed) {
    return {
      absenteeism,
      scoringRuleVersion: 2,
      individualPreserved,
      sectorPreserved: 0,
      internalTotal: 0,
      weightedP5Cents: 0,
      weightedP5: 0,
      individualDeducted: occurred,
      factoryOccurrenceCount: factoryBalance.factoryOccurrenceCount,
      factoryDeductionP5,
      factoryBalanceP5: 0,
      individualDeductionP5,
      factoryZeroed: true,
      zeroedBy: 'factory_threshold',
      zeroedByThreshold: true,
      zeroBelowPercent: factoryBalance.zeroBelowPercent,
      floorP5,
    };
  }

  const rawScoreCents = Math.max(
    0,
    factoryBalance.factoryBalanceCents - individualDeductionCents,
  );
  const applied = applyZeroBelowThresholdCents(
    rawScoreCents,
    factoryBalance.maxPoints,
    factoryBalance.zeroBelowPercent,
  );
  const zeroedBy = applied.zeroed ? 'individual_threshold' : null;
  const weightedP5Cents = applied.scoreCents;
  const internalTotal = weightedP5CentsToInternalUnits(weightedP5Cents);

  return {
    absenteeism,
    scoringRuleVersion: 2,
    individualPreserved,
    sectorPreserved: 0,
    internalTotal,
    weightedP5Cents,
    weightedP5: centsToNumber(weightedP5Cents),
    individualDeducted: occurred,
    factoryOccurrenceCount: factoryBalance.factoryOccurrenceCount,
    factoryDeductionP5,
    factoryBalanceP5,
    individualDeductionP5,
    factoryZeroed: false,
    zeroedBy,
    zeroedByThreshold: applied.zeroed,
    zeroBelowPercent: factoryBalance.zeroBelowPercent,
    floorP5,
  };
}

export function scoreAbsenteeismCycle(input: {
  indices: readonly (number | null)[];
  config: ScoringConfigV2;
}): {
  factoryBalance: AbsenteeismFactoryBalance;
  scores: AbsenteeismEmployeeScore[];
} {
  const factoryBalance = computeAbsenteeismFactoryBalance({
    config: input.config,
    factoryOccurrenceCount: countAbsenteeismFactoryOccurrences(input.indices),
  });
  return {
    factoryBalance,
    scores: input.indices.map((absenteeism) =>
      buildAbsenteeismEmployeeScore({
        absenteeism,
        config: input.config,
        factoryBalance,
      }),
    ),
  };
}

export type AbsenteeismStoredDetails = {
  absenteeism: number | null;
  individualPreserved: number;
  individualDeducted: boolean;
  sectorPreserved: number;
  partial: boolean;
  warning: string | null;
  scoringRuleVersion?: 1 | 2;
  factoryOccurrenceCount?: number;
  factoryDeductionP5?: number;
  factoryBalanceP5?: number;
  individualDeductionP5?: number;
  factoryZeroed?: boolean;
  zeroedBy?: 'factory_threshold' | 'individual_threshold' | null;
  zeroBelowPercent?: number | null;
  floorP5?: number;
};

export function absenteeismEmployeeWarning(input: {
  partial: boolean;
  individualDeducted: boolean;
}): string | null {
  if (!input.partial || !input.individualDeducted) return null;
  return ABSENTEEISM_PARTIAL_DEDUCTION_WARNING;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function parseAbsenteeismCalculationDetails(
  value: unknown,
): AbsenteeismStoredDetails | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (!('individualDeducted' in row) && !('absenteeism' in row)) {
    return null;
  }

  const absenteeism =
    row.absenteeism == null || typeof row.absenteeism === 'number'
      ? (row.absenteeism as number | null)
      : Number(row.absenteeism);
  const individualDeducted = Boolean(row.individualDeducted);
  const partial = Boolean(row.partial);
  const individualPreserved =
    typeof row.individualPreserved === 'number'
      ? row.individualPreserved
      : individualDeducted
        ? 0
        : ABSENTEEISM_INDIVIDUAL_POINTS;
  const sectorPreserved =
    typeof row.sectorPreserved === 'number'
      ? row.sectorPreserved
      : ABSENTEEISM_SECTOR_PLACEHOLDER;
  const warning =
    typeof row.warning === 'string'
      ? row.warning
      : absenteeismEmployeeWarning({ partial, individualDeducted });

  const scoringRuleVersion =
    row.scoringRuleVersion === 2 ? 2 : row.scoringRuleVersion === 1 ? 1 : undefined;
  const zeroedBy =
    row.zeroedBy === 'factory_threshold' || row.zeroedBy === 'individual_threshold'
      ? row.zeroedBy
      : row.zeroedBy === null
        ? null
        : undefined;

  const details: AbsenteeismStoredDetails = {
    absenteeism:
      absenteeism == null || Number.isNaN(absenteeism) ? null : absenteeism,
    individualPreserved,
    individualDeducted,
    sectorPreserved,
    partial,
    warning,
  };

  if (scoringRuleVersion) details.scoringRuleVersion = scoringRuleVersion;
  const factoryOccurrenceCount = optionalNumber(row.factoryOccurrenceCount);
  if (factoryOccurrenceCount != null) {
    details.factoryOccurrenceCount = factoryOccurrenceCount;
  }
  const factoryDeductionP5 = optionalNumber(row.factoryDeductionP5);
  if (factoryDeductionP5 != null) details.factoryDeductionP5 = factoryDeductionP5;
  const factoryBalanceP5 = optionalNumber(row.factoryBalanceP5);
  if (factoryBalanceP5 != null) details.factoryBalanceP5 = factoryBalanceP5;
  const individualDeductionP5 = optionalNumber(row.individualDeductionP5);
  if (individualDeductionP5 != null) {
    details.individualDeductionP5 = individualDeductionP5;
  }
  if ('factoryZeroed' in row) details.factoryZeroed = Boolean(row.factoryZeroed);
  if (zeroedBy !== undefined) details.zeroedBy = zeroedBy;
  const zeroBelowPercent = optionalNumber(row.zeroBelowPercent);
  if (zeroBelowPercent != null) details.zeroBelowPercent = zeroBelowPercent;
  else if (row.zeroBelowPercent === null) details.zeroBelowPercent = null;
  const floorP5 = optionalNumber(row.floorP5);
  if (floorP5 != null) details.floorP5 = floorP5;

  return details;
}

export type AbsenteeismScoreSummaryRow = {
  weightedP5Cents: number;
  internalCents: number;
  individualDeducted: boolean;
  partial: boolean;
  calculatedAt: Date | string | null;
};

export type AbsenteeismSectorRowInput = {
  sectorId: string;
  sectorName: string;
  costCenter: string | null;
  hasScore: boolean;
  internalCents: number;
  weightedP5Cents: number;
  individualDeducted: boolean;
  partial: boolean;
};

export type AbsenteeismSectorSummary = {
  sectorId: string;
  sectorName: string;
  costCenter: string | null;
  participantsCount: number;
  scoredCount: number;
  penalizedCount: number;
  internalAvg: number | null;
  weightedP5Avg: number | null;
  isPartial: boolean;
};

export type AbsenteeismPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

/** Agrupa participantes por setor. Médias e penalidades usam só quem já tem score. */
export function aggregateAbsenteeismSectors(
  rows: AbsenteeismSectorRowInput[],
): AbsenteeismSectorSummary[] {
  const bySector = new Map<
    string,
    {
      sectorId: string;
      sectorName: string;
      costCenter: string | null;
      participantsCount: number;
      scoredCount: number;
      penalizedCount: number;
      internalCents: number[];
      weightedCents: number[];
      isPartial: boolean;
    }
  >();

  for (const row of rows) {
    const current = bySector.get(row.sectorId) ?? {
      sectorId: row.sectorId,
      sectorName: row.sectorName,
      costCenter: row.costCenter,
      participantsCount: 0,
      scoredCount: 0,
      penalizedCount: 0,
      internalCents: [],
      weightedCents: [],
      isPartial: false,
    };
    current.participantsCount += 1;
    if (row.hasScore) {
      current.scoredCount += 1;
      current.internalCents.push(row.internalCents);
      current.weightedCents.push(row.weightedP5Cents);
      if (row.individualDeducted) current.penalizedCount += 1;
      if (row.partial) current.isPartial = true;
    }
    bySector.set(row.sectorId, current);
  }

  return [...bySector.values()]
    .map((bucket) => ({
      sectorId: bucket.sectorId,
      sectorName: bucket.sectorName,
      costCenter: bucket.costCenter,
      participantsCount: bucket.participantsCount,
      scoredCount: bucket.scoredCount,
      penalizedCount: bucket.penalizedCount,
      internalAvg:
        bucket.internalCents.length === 0
          ? null
          : centsToNumber(averageCents(bucket.internalCents)),
      weightedP5Avg:
        bucket.weightedCents.length === 0
          ? null
          : centsToNumber(averageCents(bucket.weightedCents)),
      isPartial: bucket.isPartial,
    }))
    .sort(
      (a, b) =>
        (a.weightedP5Avg ?? Number.POSITIVE_INFINITY) -
          (b.weightedP5Avg ?? Number.POSITIVE_INFINITY) ||
        a.sectorName.localeCompare(b.sectorName, 'pt-BR'),
    );
}

export function filterSectorsByCostCenter<
  T extends { costCenter: string | null },
>(sectors: T[], costCenter?: string): T[] {
  const query = costCenter?.trim().toLowerCase() ?? '';
  if (!query) return sectors;
  return sectors.filter((sector) =>
    (sector.costCenter ?? '').toLowerCase().includes(query),
  );
}

/** Paginação alinhada ao detalhe de Segurança (máx. 10). Sem `page` devolve a lista inteira. */
export function paginateItems<T>(
  items: readonly T[],
  options?: { page?: number; pageSize?: number },
): { items: T[]; pagination?: AbsenteeismPagination } {
  const paginate = options?.page != null;
  const pageSize = paginate
    ? Math.min(Math.max(options?.pageSize ?? 10, 1), 10)
    : items.length || 1;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);
  const page = paginate
    ? Math.min(Math.max(options!.page!, 1), totalPages)
    : 1;
  const slice = paginate
    ? items.slice((page - 1) * pageSize, page * pageSize)
    : [...items];

  return {
    items: slice,
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
  };
}

export function summarizeAbsenteeismCycleScores(
  rows: AbsenteeismScoreSummaryRow[],
) {
  const latestCalculatedAt = rows.reduce<string | null>((latest, row) => {
    if (!row.calculatedAt) return latest;
    const iso =
      row.calculatedAt instanceof Date
        ? row.calculatedAt.toISOString()
        : row.calculatedAt;
    if (!latest || iso > latest) return iso;
    return latest;
  }, null);

  if (rows.length === 0) {
    return {
      scoredParticipants: 0,
      penalizedCount: 0,
      isPartial: false,
      factoryInternalAvg: null as number | null,
      factoryWeightedP5Avg: null as number | null,
      calculatedAt: null as string | null,
    };
  }

  return {
    scoredParticipants: rows.length,
    penalizedCount: rows.filter((row) => row.individualDeducted).length,
    isPartial: rows.some((row) => row.partial),
    factoryInternalAvg: centsToNumber(
      averageCents(rows.map((row) => row.internalCents)),
    ),
    factoryWeightedP5Avg: centsToNumber(
      averageCents(rows.map((row) => row.weightedP5Cents)),
    ),
    calculatedAt: latestCalculatedAt,
  };
}
