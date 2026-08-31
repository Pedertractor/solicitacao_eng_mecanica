import { describe, expect, it } from 'vitest';
import {
  applyZeroBelowThresholdCents,
  buildEmployeeSafetyScoreV2,
  computeSafetyFactoryBalance,
  deductionFromOccurrences,
  defaultScoringConfigV2,
  occurrencesToZero,
  parseScoringConfig,
  resolveZeroBelowPercent,
  scopeScoringConfigForViewer,
  thresholdFloorCents,
} from './scoring-rules.js';
import { toCents } from '../lib/fixed-point.js';

describe('thresholdFloorCents', () => {
  it('20 @ 70% = 14.00', () => {
    expect(thresholdFloorCents(20, 70)).toBe(1400);
  });

  it('10 @ 70% = 7.00', () => {
    expect(thresholdFloorCents(10, 70)).toBe(700);
  });
});

describe('applyZeroBelowThresholdCents', () => {
  it('exato no piso não zera', () => {
    const r = applyZeroBelowThresholdCents(1400, 20, 70);
    expect(r.zeroed).toBe(false);
    expect(r.scoreCents).toBe(1400);
  });

  it('abaixo do piso zera', () => {
    const r = applyZeroBelowThresholdCents(1399, 20, 70);
    expect(r.zeroed).toBe(true);
    expect(r.scoreCents).toBe(0);
  });
});

describe('occurrencesToZero / deductionFromOccurrences', () => {
  it('2.06 → 3 ocorrências para zerar 20@70%', () => {
    expect(occurrencesToZero(20, 70, 2.06)).toBe(3);
  });

  it('N=4 → perda mínima 1.51', () => {
    expect(deductionFromOccurrences(20, 70, 4)).toBe(1.51);
  });

  it('3 × 2.06 = 6.18 → saldo 13.82 abaixo de 14', () => {
    const config = defaultScoringConfigV2();
    const bal = computeSafetyFactoryBalance({
      config,
      factoryWithLeaveCount: 3,
      factoryWithoutLeaveCount: 0,
    });
    expect(bal.factoryDeductionCents).toBe(toCents(6.18));
    expect(bal.factoryZeroed).toBe(true);
    expect(bal.factoryBalanceCents).toBe(0);
  });

  it('2 × 2.06 = 4.12 → saldo 15.88 não zera', () => {
    const config = defaultScoringConfigV2();
    const bal = computeSafetyFactoryBalance({
      config,
      factoryWithLeaveCount: 2,
      factoryWithoutLeaveCount: 0,
    });
    expect(bal.factoryZeroed).toBe(false);
    expect(bal.factoryBalanceCents).toBe(toCents(15.88));
  });
});

describe('buildEmployeeSafetyScoreV2', () => {
  it('sem acidentes preserva 20', () => {
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

  it('1 acidente fábrica: todos perdem 2.06; vítima perde +20 e zera', () => {
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

  it('3 acidentes: fábrica zera todos', () => {
    const config = defaultScoringConfigV2();
    const bal = computeSafetyFactoryBalance({
      config,
      factoryWithLeaveCount: 3,
      factoryWithoutLeaveCount: 0,
    });
    const peer = buildEmployeeSafetyScoreV2({
      config,
      withLeaveCount: 0,
      withoutLeaveCount: 0,
      factoryBalance: bal,
    });
    expect(peer.weightedP5).toBe(0);
    expect(peer.zeroedBy).toBe('factory_threshold');
  });
});

describe('resolveZeroBelowPercent', () => {
  it('herda global quando override null', () => {
    const config = defaultScoringConfigV2();
    expect(resolveZeroBelowPercent(config, 'SAFETY')).toBe(70);
  });

  it('usa override do pilar', () => {
    const config = defaultScoringConfigV2();
    config.pillars.SAFETY.zeroBelowPercent = 80;
    expect(resolveZeroBelowPercent(config, 'SAFETY')).toBe(80);
  });
});

describe('parseScoringConfig', () => {
  it('null → v2 default', () => {
    const c = parseScoringConfig(null);
    expect(c.version).toBe(2);
    if (c.version !== 2) return;
    expect(c.absenteeism).toEqual({
      individualPenaltyP5: 10,
      factoryDeductionP5: 1,
    });
  });

  it('reconhece legado v1', () => {
    const c = parseScoringConfig({ version: 1, legacy: true });
    expect(c.version).toBe(1);
  });

  it('JSON v2 sem bloco absenteeism recebe defaults', () => {
    const c = parseScoringConfig({
      version: 2,
      globalZeroBelowPercent: 70,
      safety: {
        withLeave: { individualPenaltyP5: 20, factoryDeductionP5: 2.06 },
        withoutLeave: { individualPenaltyP5: 20, factoryDeductionP5: 2.06 },
      },
    });
    expect(c.version).toBe(2);
    if (c.version !== 2) return;
    expect(c.absenteeism.individualPenaltyP5).toBe(10);
    expect(c.absenteeism.factoryDeductionP5).toBe(1);
  });
});

describe('scopeScoringConfigForViewer', () => {
  it('admin (null) recebe config completa', () => {
    const config = defaultScoringConfigV2();
    expect(scopeScoringConfigForViewer(config, null)).toEqual(config);
  });

  it('responsável sem SAFETY não vê penalidades reais', () => {
    const config = defaultScoringConfigV2();
    const scoped = scopeScoringConfigForViewer(config, [
      'ABSENTEEISM',
      'PRODUCTIVITY',
    ]);
    expect(scoped.version).toBe(2);
    if (scoped.version !== 2) return;
    expect(scoped.pillars.ABSENTEEISM).toEqual(config.pillars.ABSENTEEISM);
    expect(scoped.pillars.SAFETY).toBeUndefined();
    expect(scoped.safety.withLeave.individualPenaltyP5).toBe(0);
    expect(scoped.safety.withLeave.factoryDeductionP5).toBe(0);
    expect(scoped.absenteeism).toEqual(config.absenteeism);
  });

  it('responsável com SAFETY e sem ABSENTEEISM zera penalidades de absenteísmo', () => {
    const config = defaultScoringConfigV2();
    const scoped = scopeScoringConfigForViewer(config, ['SAFETY']);
    expect(scoped.version).toBe(2);
    if (scoped.version !== 2) return;
    expect(scoped.safety).toEqual(config.safety);
    expect(scoped.pillars.SAFETY).toEqual(config.pillars.SAFETY);
    expect(scoped.absenteeism.individualPenaltyP5).toBe(0);
    expect(scoped.absenteeism.factoryDeductionP5).toBe(0);
  });

  it('responsável com ABSENTEEISM preserva bloco absenteeism', () => {
    const config = defaultScoringConfigV2();
    const scoped = scopeScoringConfigForViewer(config, ['ABSENTEEISM']);
    expect(scoped.version).toBe(2);
    if (scoped.version !== 2) return;
    expect(scoped.absenteeism).toEqual(config.absenteeism);
  });
});
