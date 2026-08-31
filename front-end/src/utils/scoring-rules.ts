/** Helpers de limiar/perda do painel (espelho do backend, centésimos via floor). */

const FP = 100;

function toCents(value: number): number {
  return Math.round(Number(value.toFixed(2)) * FP);
}

function fromCents(cents: number): number {
  return Number((cents / FP).toFixed(2));
}

export function thresholdFloorP5(maxPoints: number, zeroBelowPercent: number): number {
  const maxCents = toCents(maxPoints);
  const pct = Math.min(100, Math.max(0, Math.trunc(zeroBelowPercent)));
  return fromCents(Math.floor((maxCents * pct) / 100));
}

/** Ocorrências iguais necessárias para zerar (estritamente abaixo do limiar). */
export function occurrencesToZero(
  maxPoints: number,
  zeroBelowPercent: number,
  factoryDeductionP5: number,
): number {
  const deductionCents = toCents(factoryDeductionP5);
  if (deductionCents <= 0) return Number.POSITIVE_INFINITY;
  const maxCents = toCents(maxPoints);
  const floorCents = toCents(thresholdFloorP5(maxPoints, zeroBelowPercent));
  const needDrop = maxCents - floorCents + 1;
  return Math.ceil(needDrop / deductionCents);
}

/** Perda mínima por ocorrência para N ocorrências zerarem o pilar. */
export function deductionFromOccurrences(
  maxPoints: number,
  zeroBelowPercent: number,
  occurrences: number,
): number {
  const n = Math.trunc(occurrences);
  if (n <= 0) return 0;
  const maxCents = toCents(maxPoints);
  const floorCents = toCents(thresholdFloorP5(maxPoints, zeroBelowPercent));
  const needDrop = maxCents - floorCents + 1;
  return fromCents(Math.ceil(needDrop / n));
}

export function factoryBalanceAfter(
  maxPoints: number,
  factoryDeductionP5: number,
  occurrences: number,
): number {
  const raw = toCents(maxPoints) - toCents(factoryDeductionP5) * Math.max(0, occurrences);
  return fromCents(Math.max(0, raw));
}
