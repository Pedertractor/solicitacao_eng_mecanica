/** Espelho mínimo do back-end fixed-point para formatação e agregações no UI. */
export const FP_SCALE = 100;

export function toCents(value: number | string): number {
  const str =
    typeof value === 'number'
      ? value.toFixed(2)
      : Number(value).toFixed(2);

  const negative = str.startsWith('-');
  const raw = negative ? str.slice(1) : str;
  const [wholePart, fracPart = '0'] = raw.split('.');
  const whole = Number.parseInt(wholePart || '0', 10);
  const frac = Number.parseInt((fracPart + '00').slice(0, 2), 10);
  const cents = whole * FP_SCALE + frac;
  return negative ? -cents : cents;
}

export function divFloor(numerator: number, denominator: number): number {
  if (denominator === 0) {
    throw new Error('Divisão por zero');
  }
  return Math.floor(numerator / denominator);
}

export function sumCents(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

export function avgCents(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return divFloor(sumCents(values), values.length);
}

/** Centésimos → unidades (2 casas exatas, espelho de centsToNumber do back-end). */
export function centsToUnits(cents: number): number {
  if (!Number.isInteger(cents)) {
    throw new Error(`centsToUnits espera inteiro, recebeu ${cents}`);
  }
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.trunc(abs / FP_SCALE);
  const frac = abs % FP_SCALE;
  return Number(
    `${negative ? '-' : ''}${whole}.${String(frac).padStart(2, '0')}`,
  );
}

/**
 * Percentual `(points / max) * 100` em centésimos (floor).
 * 100% só quando points === max.
 */
export function computePercentCents(pointsCents: number, maxCents: number): number {
  if (maxCents <= 0 || pointsCents <= 0) return 0;
  if (pointsCents === maxCents) return 100;
  return divFloor(pointsCents * 100 * FP_SCALE, maxCents) / FP_SCALE;
}

/** Piso em 2 casas decimais (nunca arredonda para cima). */
export function floor2(value: number): number {
  if (value === 0) return 0;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  return (sign * Math.floor(abs * FP_SCALE)) / FP_SCALE;
}

/**
 * Exibe pontuação/percentual com no máx. 2 casas, sempre para baixo.
 * Trim de zeros à direita; separador ponto.
 */
export function formatPoints(value: number): string {
  if (value === 0) return '0';
  const floored = floor2(value);
  const sign = floored < 0 ? '-' : '';
  const abs = Math.abs(floored);
  const fixed = abs.toFixed(2);
  const trimmed = fixed.replace(/\.?0+$/, '');
  return `${sign}${trimmed}`;
}

export function formatPercent(value: number): string {
  return `${formatPoints(value)}%`;
}
