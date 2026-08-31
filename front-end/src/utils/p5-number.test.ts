import { describe, expect, it } from 'vitest';
import {
  avgCents,
  centsToUnits,
  computePercentCents,
  divFloor,
  formatPercent,
  formatPoints,
  sumCents,
  toCents,
} from './p5-number';

describe('p5-number', () => {
  it('divFloor arredonda sempre para baixo', () => {
    expect(divFloor(5, 2)).toBe(2);
    expect(divFloor(1, 2)).toBe(0);
    expect(divFloor(10, 3)).toBe(3);
    expect(divFloor(-5, 2)).toBe(-3);
  });

  it('avgCents usa floor e nunca sobe', () => {
    expect(avgCents([1400, 1400, 1300])).toBe(1366);
    const avg = avgCents([1400, 1400, 1300]);
    expect(avg).toBeLessThanOrEqual(Math.max(...[1400, 1400, 1300]));
  });

  it('sumCents agrega valores inteiros', () => {
    expect(sumCents([1400, 1400, 1300])).toBe(4100);
    expect(sumCents([])).toBe(0);
  });

  it('toCents lê string / number sem lixo binário', () => {
    expect(toCents('14.00')).toBe(1400);
    expect(toCents(14)).toBe(1400);
    expect(toCents(-0.5)).toBe(-50);
  });

  it('centsToUnits converte com floor', () => {
    expect(centsToUnits(1400)).toBe(14);
    expect(centsToUnits(1366)).toBe(13.66);
  });

  it('computePercentCents: 100% só quando points === max', () => {
    expect(computePercentCents(2000, 2000)).toBe(100);
    expect(computePercentCents(0, 2000)).toBe(0);
    expect(computePercentCents(1400, 2000)).toBe(70);
  });

  it('formatPoints trim zeros e usa floor', () => {
    expect(formatPoints(20)).toBe('20');
    expect(formatPoints(14.5)).toBe('14.5');
    expect(formatPoints(19.9825)).toBe('19.98');
    expect(formatPoints(0)).toBe('0');
  });

  it('formatPercent adiciona sufixo %', () => {
    expect(formatPercent(14.5)).toBe('14.5%');
  });

  it('média de Segurança 20/14/0 → 11.33 (paridade com back-end)', () => {
    const avg = centsToUnits(avgCents([2000, 1400, 0]));
    expect(formatPoints(avg)).toBe('11.33');
  });
});
