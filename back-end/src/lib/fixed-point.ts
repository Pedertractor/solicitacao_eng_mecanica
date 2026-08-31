/**
 * Aritmética em ponto fixo (centésimos): 1 unidade = 100 centésimos.
 * Evita float IEEE-754 na regra de pontuação/médias do P5.
 */
export const FP_SCALE = 100;

/** Divisão inteira sempre para baixo. Regra única de arredondamento do P5. */
export function divFloor(numerator: number, denominator: number): number {
  if (denominator === 0) {
    throw new Error('Divisão por zero');
  }
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
    throw new Error('divFloor exige inteiros');
  }
  return Math.floor(numerator / denominator);
}

/** Inteiro de unidades (ex.: 20) → centésimos (2000). */
export function intUnitsToCents(units: number): number {
  if (!Number.isInteger(units)) {
    throw new Error(`intUnitsToCents espera inteiro, recebeu ${units}`);
  }
  return units * FP_SCALE;
}

/**
 * Converte Decimal/string/number (até 2 casas) em centésimos via string,
 * sem multiplicar float.
 */
export function toCents(
  value: string | number | { toFixed(dp: number): string },
): number {
  const str =
    typeof value === 'object' && value !== null && 'toFixed' in value
      ? value.toFixed(2)
      : typeof value === 'number'
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

/** Centésimos → string com exatamente 2 casas (`1400` → `"14.00"`). */
export function centsToFixed2(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new Error(`centsToFixed2 espera inteiro, recebeu ${cents}`);
  }
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.trunc(abs / FP_SCALE);
  const frac = abs % FP_SCALE;
  return `${negative ? '-' : ''}${whole}.${String(frac).padStart(2, '0')}`;
}

/** Centésimos → number para JSON (sempre via string de 2 casas). */
export function centsToNumber(cents: number): number {
  return Number(centsToFixed2(cents));
}

/** Soma de centésimos. */
export function sumCents(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

/** Decimal-like / string / number → unidades (2 casas) via centésimos. */
export function decimalToUnits(
  value: string | number | { toFixed(dp: number): string },
): number {
  return centsToNumber(toCents(value));
}

/** Média de centésimos com floor. */
export function averageCents(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return divFloor(sumCents(values), values.length);
}

/**
 * Proporção `(part / whole) * maxUnits` em centésimos (floor).
 * Ex.: part=70, whole=100, maxUnits=20 → 1400 (14.00).
 */
export function proportionToCents(
  part: number,
  whole: number,
  maxUnits: number,
): number {
  if (!Number.isInteger(part) || !Number.isInteger(whole) || !Number.isInteger(maxUnits)) {
    throw new Error('proportionToCents exige inteiros');
  }
  if (whole <= 0) {
    throw new Error('proportionToCents: whole deve ser > 0');
  }
  return divFloor(part * maxUnits * FP_SCALE, whole);
}
