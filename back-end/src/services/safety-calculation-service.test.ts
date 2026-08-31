import { describe, expect, it } from 'vitest';
import {
  ANNUAL_BASE_POINTS,
  CYCLES_PER_PROGRAM_YEAR,
  MONTHLY_BASE_POINTS,
} from '../constants/p5-scoring.js';
import {
  applyZeroOccurrenceRule,
  buildEmployeeSafetyScore,
  convertInternalToP5Cents,
  convertInternalToP5Points,
  SAFETY_INTERNAL_MAX,
  SAFETY_P5_MAX_POINTS,
} from './safety-calculation-service.js';
import {
  buildEmployeeSafetyScoreV2,
  computeSafetyFactoryBalance,
  defaultScoringConfigV2,
} from './scoring-rules.js';
import { averageCents, centsToNumber, toCents } from '../lib/fixed-point.js';

describe('pontuação anual do programa', () => {
  it('cada mês tem 100 pontos base e o ano completo 1200', () => {
    expect(MONTHLY_BASE_POINTS).toBe(100);
    expect(CYCLES_PER_PROGRAM_YEAR).toBe(12);
    expect(ANNUAL_BASE_POINTS).toBe(1200);
  });
});

describe('applyZeroOccurrenceRule', () => {
  it('zero ocorrências preserva o máximo', () => {
    expect(
      applyZeroOccurrenceRule({
        validatedOccurrences: 0,
        maxInternalPoints: 50,
      }),
    ).toBe(50);
  });

  it('1+ ocorrência zera o indicador', () => {
    expect(
      applyZeroOccurrenceRule({
        validatedOccurrences: 1,
        maxInternalPoints: 50,
      }),
    ).toBe(0);
  });
});

/**
 * buildEmployeeSafetyScore = fórmula LEGADA 50/30/20.
 * Cálculo ao vivo usa buildEmployeeSafetyScoreV2 (ver scoring-rules.test.ts).
 */
describe('buildEmployeeSafetyScore — regra individual legada', () => {
  it('sem acidentes preserva 100 internos (20 P5)', () => {
    const score = buildEmployeeSafetyScore({
      withLeaveCount: 0,
      withoutLeaveCount: 0,
    });
    expect(score.internalTotal).toBe(100);
    expect(score.frequencyPreserved).toBe(20);
    expect(score.isRecidivist).toBe(false);
    expect(score.weightedP5).toBe(20);
  });

  it('1 acidente com afastamento desconta 50 do colaborador', () => {
    const score = buildEmployeeSafetyScore({
      withLeaveCount: 1,
      withoutLeaveCount: 0,
    });
    expect(score.withLeaveDeduction).toBe(50);
    expect(score.frequencyDeduction).toBe(0);
    expect(score.internalTotal).toBe(50);
    expect(score.weightedP5).toBe(10);
  });

  it('1 acidente sem afastamento desconta 30', () => {
    const score = buildEmployeeSafetyScore({
      withLeaveCount: 0,
      withoutLeaveCount: 1,
    });
    expect(score.withoutLeaveDeduction).toBe(30);
    expect(score.internalTotal).toBe(70);
    expect(score.weightedP5).toBe(14);
  });

  it('2 acidentes com afastamento: 50+50+20 de reincidência, piso 0', () => {
    const score = buildEmployeeSafetyScore({
      withLeaveCount: 2,
      withoutLeaveCount: 0,
    });
    expect(score.isRecidivist).toBe(true);
    expect(score.withLeaveDeduction).toBe(100);
    expect(score.frequencyDeduction).toBe(20);
    expect(score.rawInternal).toBe(-20);
    expect(score.internalTotal).toBe(0);
    expect(score.weightedP5).toBe(0);
  });

  it('1 com + 1 sem afastamento: 50+30+20 = 0', () => {
    const score = buildEmployeeSafetyScore({
      withLeaveCount: 1,
      withoutLeaveCount: 1,
    });
    expect(score.isRecidivist).toBe(true);
    expect(score.internalTotal).toBe(0);
    expect(score.weightedP5).toBe(0);
  });

  it('nunca fica negativo mesmo com muitos acidentes', () => {
    const score = buildEmployeeSafetyScore({
      withLeaveCount: 5,
      withoutLeaveCount: 5,
    });
    expect(score.internalTotal).toBe(0);
    expect(score.internalTotal).toBeGreaterThanOrEqual(0);
  });

  it('pontuação nunca ultrapassa 100 internos / 20 P5', () => {
    const score = buildEmployeeSafetyScore({
      withLeaveCount: 0,
      withoutLeaveCount: 0,
    });
    expect(score.internalTotal).toBeLessThanOrEqual(SAFETY_INTERNAL_MAX);
    expect(score.weightedP5).toBeLessThanOrEqual(SAFETY_P5_MAX_POINTS);
  });
});

describe('convertInternalToP5Points', () => {
  it('100 internos = 20 P5', () => {
    expect(convertInternalToP5Cents(100)).toBe(2000);
    expect(convertInternalToP5Points(100)).toBe(20);
  });

  it('70 internos = 14 P5', () => {
    expect(convertInternalToP5Cents(70)).toBe(1400);
    expect(convertInternalToP5Points(70)).toBe(14);
  });

  it('0 internos = 0 P5', () => {
    expect(convertInternalToP5Cents(0)).toBe(0);
    expect(convertInternalToP5Points(0)).toBe(0);
  });

  it('score individual expõe weightedP5Cents exato', () => {
    const score = buildEmployeeSafetyScore({
      withLeaveCount: 0,
      withoutLeaveCount: 1,
    });
    expect(score.weightedP5Cents).toBe(1400);
    expect(score.weightedP5).toBe(14);
  });

  it('média de weightedP5 com resto usa floor (20/14/0 → 11.33)', () => {
    const avg = centsToNumber(averageCents([2000, 1400, 0]));
    expect(avg).toBe(11.33);
  });
});

describe('buildEmployeeSafetyScoreV2 — regra coletiva (smoke)', () => {
  it('fábrica sem acidentes preserva 20 P5 para todos', () => {
    const config = defaultScoringConfigV2();
    const bal = computeSafetyFactoryBalance({
      config,
      factoryWithLeaveCount: 0,
      factoryWithoutLeaveCount: 0,
    });
    const score = buildEmployeeSafetyScoreV2({
      config,
      withLeaveCount: 0,
      withoutLeaveCount: 0,
      factoryBalance: bal,
    });
    expect(score.weightedP5).toBe(20);
    expect(score.zeroedBy).toBeNull();
  });

  it('1 acidente: vítima zera; demais ficam com saldo fábrica', () => {
    const config = defaultScoringConfigV2();
    const bal = computeSafetyFactoryBalance({
      config,
      factoryWithLeaveCount: 1,
      factoryWithoutLeaveCount: 0,
    });
    expect(bal.factoryBalanceCents).toBe(toCents(17.94));

    const victim = buildEmployeeSafetyScoreV2({
      config,
      withLeaveCount: 1,
      withoutLeaveCount: 0,
      factoryBalance: bal,
    });
    expect(victim.weightedP5).toBe(0);
    expect(victim.zeroedBy).toBe('individual_threshold');

    const peer = buildEmployeeSafetyScoreV2({
      config,
      withLeaveCount: 0,
      withoutLeaveCount: 0,
      factoryBalance: bal,
    });
    expect(peer.weightedP5).toBe(17.94);
  });
});
