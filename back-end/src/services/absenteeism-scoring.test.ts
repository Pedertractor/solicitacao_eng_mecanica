import { describe, expect, it } from 'vitest';
import {
  ABSENTEEISM_INDEX_THRESHOLD,
  ABSENTEEISM_P5_MAX,
  ABSENTEEISM_PARTIAL_DEDUCTION_WARNING,
} from '../constants/absenteeism-scoring.js';
import { calendarMonthInSaoPaulo, isCurrentCalendarMonth, previousCalendarMonth } from '../lib/calendar-month.js';
import { normalizeCardNumber } from '../lib/card-number.js';
import { intUnitsToCents, toCents } from '../lib/fixed-point.js';
import { HttpError } from '../https/errors/index.js';
import {
  absenteeismEmployeeWarning,
  aggregateAbsenteeismSectors,
  buildAbsenteeismEmployeeScore,
  computeAbsenteeismFactoryBalance,
  countAbsenteeismFactoryOccurrences,
  filterSectorsByCostCenter,
  paginateItems,
  parseAbsenteeismCalculationDetails,
  scoreAbsenteeismCycle,
  summarizeAbsenteeismCycleScores,
} from './absenteeism-scoring.js';
import {
  assertCycleWritableForP5Data,
  buildAbsenteeismLookup,
  mapCompanyToUnit,
  WRITABLE_CYCLE_STATUSES,
} from './absenteeism-calculation-service.js';
import { defaultScoringConfigV2 } from './scoring-rules.js';

function scoreCycle(indices: Array<number | null>) {
  return scoreAbsenteeismCycle({
    indices,
    config: defaultScoringConfigV2(),
  });
}

describe('countAbsenteeismFactoryOccurrences', () => {
  it('conta só índices estritamente abaixo de 100', () => {
    expect(
      countAbsenteeismFactoryOccurrences([110, 100, 99.9, null, 0]),
    ).toBe(2);
  });
});

describe('buildAbsenteeismEmployeeScore / saldo de fábrica', () => {
  it('0 ocorrências preserva 10 P5', () => {
    const { scores } = scoreCycle([103.31]);
    expect(scores[0]?.weightedP5).toBe(ABSENTEEISM_P5_MAX);
    expect(scores[0]?.individualDeducted).toBe(false);
    expect(scores[0]?.zeroedBy).toBeNull();
    expect(scores[0]?.internalTotal).toBe(100);
  });

  it('1 ocorrência: vítima zera; demais perdem 1', () => {
    const { factoryBalance, scores } = scoreCycle([80, 110]);
    expect(factoryBalance.factoryBalanceCents).toBe(toCents(9));
    expect(scores[0]?.weightedP5).toBe(0);
    expect(scores[0]?.individualDeducted).toBe(true);
    expect(scores[0]?.zeroedBy).toBe('individual_threshold');
    expect(scores[1]?.weightedP5).toBe(9);
    expect(scores[1]?.individualDeducted).toBe(false);
  });

  it('no limiar exato (100) não gera ocorrência', () => {
    const { scores } = scoreCycle([ABSENTEEISM_INDEX_THRESHOLD]);
    expect(scores[0]?.individualDeducted).toBe(false);
    expect(scores[0]?.weightedP5).toBe(10);
  });

  it('ausente na procedure não gera ocorrência, mas recebe perda coletiva', () => {
    const { scores } = scoreCycle([null, 50]);
    expect(scores[0]?.individualDeducted).toBe(false);
    expect(scores[0]?.weightedP5).toBe(9);
    expect(scores[1]?.weightedP5).toBe(0);
  });

  it('ausente sozinho preserva 10', () => {
    const { scores } = scoreCycle([null]);
    expect(scores[0]?.weightedP5).toBe(10);
    expect(scores[0]?.individualDeducted).toBe(false);
  });

  it('4 ocorrências + 70% zeram a fábrica para todos', () => {
    const { factoryBalance, scores } = scoreCycle([50, 40, 30, 20]);
    expect(factoryBalance.factoryZeroed).toBe(true);
    expect(scores.every((score) => score.weightedP5 === 0)).toBe(true);
    expect(scores[0]?.zeroedBy).toBe('factory_threshold');
  });

  it('índice ok sozinho com limiar 70% mantém 10', () => {
    const score = buildAbsenteeismEmployeeScore({
      absenteeism: 100,
      config: defaultScoringConfigV2(),
      factoryBalance: computeAbsenteeismFactoryBalance({
        config: defaultScoringConfigV2(),
        factoryOccurrenceCount: 0,
      }),
    });
    expect(score.weightedP5).toBe(10);
    expect(score.zeroedByThreshold).toBe(false);
  });
});

describe('absenteeismEmployeeWarning', () => {
  it('só avisa perda no resultado parcial do cron', () => {
    expect(
      absenteeismEmployeeWarning({
        partial: true,
        individualDeducted: true,
      }),
    ).toBe(ABSENTEEISM_PARTIAL_DEDUCTION_WARNING);
    expect(
      absenteeismEmployeeWarning({
        partial: true,
        individualDeducted: false,
      }),
    ).toBeNull();
    expect(
      absenteeismEmployeeWarning({
        partial: false,
        individualDeducted: true,
      }),
    ).toBeNull();
  });
});

describe('parseAbsenteeismCalculationDetails', () => {
  it('lê parcial + aviso gravados no score do pilar', () => {
    const details = parseAbsenteeismCalculationDetails({
      absenteeism: 80,
      individualPreserved: 0,
      individualDeducted: true,
      sectorPreserved: 60,
      partial: true,
      warning: ABSENTEEISM_PARTIAL_DEDUCTION_WARNING,
    });
    expect(details).toEqual({
      absenteeism: 80,
      individualPreserved: 0,
      individualDeducted: true,
      sectorPreserved: 60,
      partial: true,
      warning: ABSENTEEISM_PARTIAL_DEDUCTION_WARNING,
    });
  });

  it('lê campos v2 de saldo de fábrica', () => {
    const details = parseAbsenteeismCalculationDetails({
      absenteeism: 80,
      individualPreserved: 0,
      individualDeducted: true,
      sectorPreserved: 0,
      scoringRuleVersion: 2,
      factoryOccurrenceCount: 1,
      factoryDeductionP5: 1,
      factoryBalanceP5: 9,
      individualDeductionP5: 10,
      factoryZeroed: false,
      zeroedBy: 'individual_threshold',
      zeroBelowPercent: 70,
      floorP5: 7,
      partial: false,
    });
    expect(details?.scoringRuleVersion).toBe(2);
    expect(details?.factoryBalanceP5).toBe(9);
    expect(details?.individualDeductionP5).toBe(10);
    expect(details?.zeroedBy).toBe('individual_threshold');
  });

  it('ignora calculationDetails de outro pilar', () => {
    expect(
      parseAbsenteeismCalculationDetails({
        isRecidivist: true,
        withLeave: 1,
      }),
    ).toBeNull();
  });
});

describe('summarizeAbsenteeismCycleScores', () => {
  it('média da fábrica usa só scores de absenteísmo (máx. 10)', () => {
    const { scores } = scoreCycle([110, 80]);
    const [kept, lost] = scores;
    const summary = summarizeAbsenteeismCycleScores([
      {
        weightedP5Cents: kept!.weightedP5Cents,
        internalCents: intUnitsToCents(kept!.internalTotal),
        individualDeducted: kept!.individualDeducted,
        partial: true,
        calculatedAt: '2026-08-20T03:30:00.000Z',
      },
      {
        weightedP5Cents: lost!.weightedP5Cents,
        internalCents: intUnitsToCents(lost!.internalTotal),
        individualDeducted: lost!.individualDeducted,
        partial: true,
        calculatedAt: '2026-08-20T03:30:00.000Z',
      },
    ]);

    expect(kept?.weightedP5).toBe(9);
    expect(lost?.weightedP5).toBe(0);
    expect(summary.scoredParticipants).toBe(2);
    expect(summary.penalizedCount).toBe(1);
    expect(summary.isPartial).toBe(true);
    expect(summary.factoryWeightedP5Avg).toBe(4.5);
  });

  it('ciclo sem scores não marca parcial nem inventa média', () => {
    const summary = summarizeAbsenteeismCycleScores([]);
    expect(summary.scoredParticipants).toBe(0);
    expect(summary.penalizedCount).toBe(0);
    expect(summary.isPartial).toBe(false);
    expect(summary.factoryWeightedP5Avg).toBeNull();
  });

  it('mês fechado (parcial false) não propaga aviso de cron', () => {
    const lost = scoreCycle([50]).scores[0]!;
    const summary = summarizeAbsenteeismCycleScores([
      {
        weightedP5Cents: lost.weightedP5Cents,
        internalCents: intUnitsToCents(lost.internalTotal),
        individualDeducted: true,
        partial: false,
        calculatedAt: null,
      },
    ]);
    expect(summary.isPartial).toBe(false);
    expect(summary.penalizedCount).toBe(1);
  });
});

describe('aggregateAbsenteeismSectors', () => {
  it('médias e penalidades usam só quem já tem score no setor', () => {
    const { scores } = scoreCycle([110, 80]);
    const [kept, lost] = scores;
    const sectors = aggregateAbsenteeismSectors([
      {
        sectorId: 'setor-a',
        sectorName: 'Usinagem',
        costCenter: 'CC-10',
        hasScore: true,
        internalCents: intUnitsToCents(kept!.internalTotal),
        weightedP5Cents: kept!.weightedP5Cents,
        individualDeducted: kept!.individualDeducted,
        partial: false,
      },
      {
        sectorId: 'setor-a',
        sectorName: 'Usinagem',
        costCenter: 'CC-10',
        hasScore: true,
        internalCents: intUnitsToCents(lost!.internalTotal),
        weightedP5Cents: lost!.weightedP5Cents,
        individualDeducted: lost!.individualDeducted,
        partial: true,
      },
      {
        sectorId: 'setor-a',
        sectorName: 'Usinagem',
        costCenter: 'CC-10',
        hasScore: false,
        internalCents: 0,
        weightedP5Cents: 0,
        individualDeducted: false,
        partial: false,
      },
      {
        sectorId: 'setor-b',
        sectorName: 'Montagem',
        costCenter: 'CC-20',
        hasScore: true,
        internalCents: intUnitsToCents(lost!.internalTotal),
        weightedP5Cents: lost!.weightedP5Cents,
        individualDeducted: true,
        partial: false,
      },
    ]);

    expect(sectors[0]?.sectorName).toBe('Montagem');
    expect(sectors[0]?.penalizedCount).toBe(1);
    expect(sectors[0]?.weightedP5Avg).toBe(0);
    expect(sectors[1]?.sectorName).toBe('Usinagem');
    expect(sectors[1]?.participantsCount).toBe(3);
    expect(sectors[1]?.scoredCount).toBe(2);
    expect(sectors[1]?.penalizedCount).toBe(1);
    expect(sectors[1]?.weightedP5Avg).toBe(4.5);
    expect(sectors[1]?.isPartial).toBe(true);
  });

  it('setor sem scores não inventa média nem penalidade', () => {
    const [sector] = aggregateAbsenteeismSectors([
      {
        sectorId: 'setor-vazio',
        sectorName: 'Pintura',
        costCenter: null,
        hasScore: false,
        internalCents: 0,
        weightedP5Cents: 0,
        individualDeducted: false,
        partial: false,
      },
    ]);
    expect(sector?.participantsCount).toBe(1);
    expect(sector?.penalizedCount).toBe(0);
    expect(sector?.internalAvg).toBeNull();
    expect(sector?.weightedP5Avg).toBeNull();
  });
});

describe('filterSectorsByCostCenter', () => {
  it('filtra parcial e não vaza setor de outro CC', () => {
    const sectors = [
      { sectorName: 'A', costCenter: 'CC-10' },
      { sectorName: 'B', costCenter: 'CC-20' },
      { sectorName: 'C', costCenter: null },
    ];
    expect(filterSectorsByCostCenter(sectors, '10')).toEqual([
      { sectorName: 'A', costCenter: 'CC-10' },
    ]);
    expect(filterSectorsByCostCenter(sectors, '  ')).toHaveLength(3);
  });
});

describe('paginateItems', () => {
  it('pagina 10 itens e limita pageSize a 10', () => {
    const items = Array.from({ length: 12 }, (_, index) => index + 1);
    const first = paginateItems(items, { page: 1, pageSize: 99 });
    expect(first.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(first.pagination).toEqual({
      page: 1,
      pageSize: 10,
      totalItems: 12,
      totalPages: 2,
    });
    expect(paginateItems(items, { page: 2, pageSize: 10 }).items).toEqual([
      11, 12,
    ]);
  });

  it('sem page devolve a lista inteira', () => {
    const result = paginateItems([1, 2, 3]);
    expect(result.items).toEqual([1, 2, 3]);
    expect(result.pagination).toBeUndefined();
  });
});

describe('previousCalendarMonth', () => {
  it('agosto/2026 → julho/2026', () => {
    expect(previousCalendarMonth(8, 2026)).toEqual({ month: 7, year: 2026 });
  });

  it('janeiro/2026 → dezembro/2025', () => {
    expect(previousCalendarMonth(1, 2026)).toEqual({ month: 12, year: 2025 });
  });
});

describe('normalizeCardNumber', () => {
  it('normaliza CRACHA com zeros à esquerda', () => {
    expect(normalizeCardNumber(17)).toBe('17');
    expect(normalizeCardNumber('0017')).toBe('17');
    expect(normalizeCardNumber(5487)).toBe('5487');
  });
});

describe('buildAbsenteeismLookup', () => {
  it('indexa por unidade + cartão normalizado', () => {
    const map = buildAbsenteeismLookup([
      {
        company: 'PEDERTRACTOR',
        cardNumber: 17,
        name: 'Fulano',
        situation: 'Trabalhando',
        referenceDate: null,
        absenteeism: 80,
      },
    ]);

    expect(map.get('PEDERTRACTOR:17')?.absenteeism).toBe(80);
  });

  it('ignora empresa desconhecida', () => {
    const map = buildAbsenteeismLookup([
      {
        company: 'OUTRA',
        cardNumber: 1,
        name: 'X',
        situation: '',
        referenceDate: null,
        absenteeism: 50,
      },
    ]);
    expect(map.size).toBe(0);
  });
});

describe('mapCompanyToUnit', () => {
  it('mapeia EMPRESA da procedure para Unit', () => {
    expect(mapCompanyToUnit('PEDERTRACTOR')).toBe('PEDERTRACTOR');
    expect(mapCompanyToUnit('tractor')).toBe('TRACTOR');
    expect(mapCompanyToUnit('invalid')).toBeNull();
  });
});

describe('WRITABLE_CYCLE_STATUSES', () => {
  it('permite UNDER_REVIEW e bloqueia LOCKED/HOMOLOGATED', () => {
    expect(WRITABLE_CYCLE_STATUSES).toContain('UNDER_REVIEW');
    expect(WRITABLE_CYCLE_STATUSES).toContain('OPEN');
    expect(WRITABLE_CYCLE_STATUSES).not.toContain('LOCKED');
    expect(WRITABLE_CYCLE_STATUSES).not.toContain('HOMOLOGATED');
    expect(WRITABLE_CYCLE_STATUSES).not.toContain('DRAFT');
  });
});

describe('assertCycleWritableForP5Data', () => {
  it('bloqueia ciclo homologado', () => {
    expect(() => assertCycleWritableForP5Data('HOMOLOGATED')).toThrow(HttpError);
    try {
      assertCycleWritableForP5Data('HOMOLOGATED');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).statusCode).toBe(409);
      expect((error as HttpError).message).toBe(
        'Não é possível atualizar dados do P5 de um ciclo homologado ou bloqueado.',
      );
    }
  });

  it('bloqueia ciclo bloqueado', () => {
    expect(() => assertCycleWritableForP5Data('LOCKED')).toThrow(HttpError);
  });

  it('permite ciclo aberto, calculado ou em revisão', () => {
    expect(() => assertCycleWritableForP5Data('OPEN')).not.toThrow();
    expect(() => assertCycleWritableForP5Data('CALCULATED')).not.toThrow();
    expect(() => assertCycleWritableForP5Data('UNDER_REVIEW')).not.toThrow();
  });
});

describe('isCurrentCalendarMonth', () => {
  it('agosto/2026 é o mês civil atual nesse instante', () => {
    const now = new Date('2026-08-20T12:00:00-03:00');
    expect(calendarMonthInSaoPaulo(now)).toEqual({ month: 8, year: 2026 });
    expect(isCurrentCalendarMonth(8, 2026, now)).toBe(true);
    expect(isCurrentCalendarMonth(1, 2026, now)).toBe(false);
  });
});
