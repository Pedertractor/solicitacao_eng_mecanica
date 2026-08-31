import { describe, expect, it } from 'vitest';
import {
  averageCents,
  centsToFixed2,
  centsToNumber,
  divFloor,
  intUnitsToCents,
  proportionToCents,
  sumCents,
  toCents,
} from './fixed-point.js';

describe('fixed-point', () => {
  it('intUnitsToCents e centsToFixed2 são inversos para inteiros', () => {
    expect(intUnitsToCents(20)).toBe(2000);
    expect(centsToFixed2(2000)).toBe('20.00');
    expect(centsToFixed2(1400)).toBe('14.00');
    expect(centsToNumber(1400)).toBe(14);
  });

  it('toCents lê Decimal-like / string / number sem lixo binário', () => {
    expect(toCents('14.00')).toBe(1400);
    expect(toCents(14)).toBe(1400);
    expect(toCents({ toFixed: () => '13.50' })).toBe(1350);
    expect(toCents(-0.5)).toBe(-50);
  });

  it('divFloor arredonda sempre para baixo', () => {
    expect(divFloor(5, 2)).toBe(2);
    expect(divFloor(1, 2)).toBe(0);
    expect(divFloor(10, 3)).toBe(3);
    expect(divFloor(-5, 2)).toBe(-3);
  });

  it('proportionToCents: 70/100 * 20 = 14.00 exato', () => {
    expect(proportionToCents(70, 100, 20)).toBe(1400);
    expect(proportionToCents(100, 100, 20)).toBe(2000);
    expect(proportionToCents(0, 100, 20)).toBe(0);
  });

  it('averageCents usa floor e nunca sobe', () => {
    // (14 + 14 + 13) / 3 = 13.666… → 13.66 floor
    expect(averageCents([1400, 1400, 1300])).toBe(1366);
    expect(centsToFixed2(averageCents([1400, 1400, 1300]))).toBe('13.66');
    const avg = averageCents([1400, 1400, 1300]);
    expect(avg).toBeLessThanOrEqual(Math.max(...[1400, 1400, 1300]));
  });

  it('sumCents agrega valores inteiros', () => {
    expect(sumCents([1400, 1400, 1300])).toBe(4100);
    expect(sumCents([])).toBe(0);
  });
});
