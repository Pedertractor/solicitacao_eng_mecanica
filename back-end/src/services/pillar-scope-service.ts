import { $Enums } from '../generated/prisma/client.js';
import {
  averageCents,
  centsToNumber,
  divFloor,
  sumCents,
  toCents,
} from '../lib/fixed-point.js';

/** `null` = ADMIN (sem restrição). Array vazio = nenhum pilar visível. */
export type ScopedPillarCodes = $Enums.PillarCode[] | null;

export type PillarMaxConfig = {
  code: $Enums.PillarCode;
  maxPoints: number;
};

export type ScopedPillarScoreInput = {
  pillarCode: string;
  weightedPoints: number;
};

export const DEFAULT_PILLAR_MAX: PillarMaxConfig[] = [
  { code: $Enums.PillarCode.SAFETY, maxPoints: 20 },
  { code: $Enums.PillarCode.PRODUCTIVITY, maxPoints: 25 },
  { code: $Enums.PillarCode.QUALITY_5S, maxPoints: 20 },
  { code: $Enums.PillarCode.ABSENTEEISM, maxPoints: 10 },
  { code: $Enums.PillarCode.REVENUE, maxPoints: 25 },
];

export function isAdminScope(allowedPillarCodes: ScopedPillarCodes): boolean {
  return allowedPillarCodes === null;
}

export function isPillarAllowed(
  code: $Enums.PillarCode | string,
  allowedPillarCodes: ScopedPillarCodes,
): boolean {
  if (allowedPillarCodes === null) return true;
  return allowedPillarCodes.includes(code as $Enums.PillarCode);
}

export function canViewSafety(allowedPillarCodes: ScopedPillarCodes): boolean {
  return isPillarAllowed($Enums.PillarCode.SAFETY, allowedPillarCodes);
}

export function filterByPillarCode<T extends { code: $Enums.PillarCode | string }>(
  items: T[],
  allowedPillarCodes: ScopedPillarCodes,
): T[] {
  if (allowedPillarCodes === null) return items;
  return items.filter((item) =>
    allowedPillarCodes.includes(item.code as $Enums.PillarCode),
  );
}

export function filterPillarScores<T extends { pillarCode: string }>(
  scores: T[],
  allowedPillarCodes: ScopedPillarCodes,
): T[] {
  if (allowedPillarCodes === null) return scores;
  return scores.filter((score) =>
    allowedPillarCodes.includes(score.pillarCode as $Enums.PillarCode),
  );
}

export function filterPillarCodeList(
  codes: unknown,
  allowedPillarCodes: ScopedPillarCodes,
): unknown {
  if (allowedPillarCodes === null) return codes;
  if (!Array.isArray(codes)) return codes;
  return codes.filter((code) =>
    allowedPillarCodes.includes(String(code) as $Enums.PillarCode),
  );
}

export function visibleMaxPointsCents(
  pillarConfigs: PillarMaxConfig[],
  allowedPillarCodes: ScopedPillarCodes,
): number {
  const visible = filterByPillarCode(pillarConfigs, allowedPillarCodes);
  if (visible.length === 0) return 0;
  return sumCents(visible.map((pillar) => toCents(pillar.maxPoints)));
}

export function visibleMaxPoints(
  pillarConfigs: PillarMaxConfig[],
  allowedPillarCodes: ScopedPillarCodes,
): number {
  return centsToNumber(visibleMaxPointsCents(pillarConfigs, allowedPillarCodes));
}

/**
 * Pontos visíveis de um participante no escopo:
 * - pilar calculado → weightedPoints;
 * - pilar autorizado sem score → maxPoints (preservação);
 * - ADMIN sem scores → soma dos máximos de todos os pilares.
 */
export function computeVisiblePointsCents(
  pillarScores: ScopedPillarScoreInput[],
  pillarConfigs: PillarMaxConfig[],
  allowedPillarCodes: ScopedPillarCodes,
): number {
  const visibleConfigs = filterByPillarCode(pillarConfigs, allowedPillarCodes);
  if (visibleConfigs.length === 0) return 0;

  if (allowedPillarCodes === null && pillarScores.length === 0) {
    return visibleMaxPointsCents(pillarConfigs, null);
  }

  const scoreByCode = new Map(
    filterPillarScores(pillarScores, allowedPillarCodes).map((score) => [
      score.pillarCode,
      score,
    ]),
  );

  let totalCents = 0;
  for (const config of visibleConfigs) {
    const score = scoreByCode.get(config.code);
    totalCents += score
      ? toCents(score.weightedPoints)
      : toCents(config.maxPoints);
  }
  return totalCents;
}

export function computeVisiblePoints(
  pillarScores: ScopedPillarScoreInput[],
  pillarConfigs: PillarMaxConfig[],
  allowedPillarCodes: ScopedPillarCodes,
): number {
  return centsToNumber(
    computeVisiblePointsCents(pillarScores, pillarConfigs, allowedPillarCodes),
  );
}

export function computeAveragePoints(
  pointsCents: readonly number[],
): number {
  if (pointsCents.length === 0) return 0;
  return centsToNumber(averageCents(pointsCents));
}

export function computeAverageFromTotalCents(
  totalCents: number,
  count: number,
): number {
  if (count === 0) return 0;
  return centsToNumber(divFloor(totalCents, count));
}

export function scopeAccidentsCount(
  count: number,
  allowedPillarCodes: ScopedPillarCodes,
): number | null {
  if (!canViewSafety(allowedPillarCodes)) return null;
  return count;
}
