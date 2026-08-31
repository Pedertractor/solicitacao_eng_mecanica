import { describe, expect, it } from 'vitest';
import { $Enums } from '../generated/prisma/client.js';
import {
  auditActionForOperation,
  classifyActOperation,
  classifyConditionOperation,
  compareSourceChangedAt,
  diffAccidentStates,
  isRealAccidentCount,
  isScoreableSafetyOccurrence,
  isVisibleSafetyOccurrence,
  safetyScoreFieldsChanged,
  shouldIgnoreConditionEvent,
  toComparableState,
  type SafetyAccidentSnapshot,
} from './safety-accident-state.js';

const baseSnapshot = (): SafetyAccidentSnapshot => ({
  id: 'acc-1',
  externalId: 'ext-1',
  sourceSystem: $Enums.SourceSystem.CIPA,
  cycleId: 'cycle-1',
  cycleYear: 2026,
  cycleMonth: 8,
  employeeId: 'emp-1',
  employeeName: 'Maria',
  cardNumber: '5487',
  unit: 'PEDERTRACTOR',
  sectorId: 'sector-1',
  sectorName: 'Setor A',
  costCenter: '1001',
  accidentType: $Enums.AccidentType.WITH_LEAVE,
  status: $Enums.AccidentStatus.VALIDATED,
  occurredAt: '2026-08-05T13:30:00.000Z',
  daysAway: 3,
  description: 'Teste',
  sourceChangedAt: '2026-08-05T14:00:00.000Z',
  cancelledAt: null,
});

describe('shouldIgnoreConditionEvent', () => {
  it('ignora condição nova e condição sem mudança', () => {
    expect(
      shouldIgnoreConditionEvent({
        nature: 'CONDITION',
        previousNature: null,
      }),
    ).toBe(true);
    expect(
      shouldIgnoreConditionEvent({
        nature: 'CONDITION',
        previousNature: 'CONDITION',
      }),
    ).toBe(true);
  });
});

describe('classifyActOperation', () => {
  it('classifica criação, restauração e reclassificação', () => {
    const next = toComparableState(baseSnapshot());
    expect(
      classifyActOperation({
        existing: null,
        next,
        previousNature: null,
      }),
    ).toBe('CREATED');
    expect(
      classifyActOperation({
        existing: { ...baseSnapshot(), status: $Enums.AccidentStatus.CANCELLED },
        next,
        previousNature: 'CONDITION',
      }),
    ).toBe('RESTORED');
    expect(
      classifyActOperation({
        existing: baseSnapshot(),
        next: {
          ...toComparableState(baseSnapshot()),
          accidentType: $Enums.AccidentType.WITHOUT_LEAVE,
        },
        previousNature: 'ACT',
      }),
    ).toBe('UPDATED');
  });
});

describe('classifyConditionOperation', () => {
  it('classifica condição ignorada e reclassificação para condição', () => {
    expect(
      classifyConditionOperation({
        existing: null,
        previousNature: null,
      }),
    ).toBe('IGNORED_CONDITION');
    expect(
      classifyConditionOperation({
        existing: baseSnapshot(),
        previousNature: 'ACT',
      }),
    ).toBe('RECLASSIFIED_TO_CONDITION');
  });
});

describe('compareSourceChangedAt', () => {
  it('detecta evento antigo, igual e posterior', () => {
    const stored = new Date('2026-08-05T14:00:00.000Z');
    expect(
      compareSourceChangedAt(
        stored,
        new Date('2026-08-05T13:00:00.000Z'),
      ),
    ).toBe('STALE');
    expect(
      compareSourceChangedAt(
        stored,
        new Date('2026-08-05T14:00:00.000Z'),
      ),
    ).toBe('UNCHANGED');
    expect(
      compareSourceChangedAt(
        stored,
        new Date('2026-08-05T15:00:00.000Z'),
      ),
    ).toBe('APPLY');
  });
});

describe('visibilidade e pontuação', () => {
  it('cancelado não é visível nem pontuável', () => {
    expect(
      isVisibleSafetyOccurrence({
        status: $Enums.AccidentStatus.CANCELLED,
      }),
    ).toBe(false);
    expect(
      isScoreableSafetyOccurrence({
        status: $Enums.AccidentStatus.CANCELLED,
        accidentType: $Enums.AccidentType.WITH_LEAVE,
      }),
    ).toBe(false);
  });

  it('frequência não entra na contagem de acidentes reais', () => {
    expect(
      isRealAccidentCount({
        status: $Enums.AccidentStatus.VALIDATED,
        accidentType: $Enums.AccidentType.FREQUENCY,
      }),
    ).toBe(false);
  });
});

describe('safetyScoreFieldsChanged', () => {
  it('ignora só descrição e recalcula mudança de tipo/status', () => {
    expect(safetyScoreFieldsChanged(['description'])).toBe(false);
    expect(safetyScoreFieldsChanged(['accidentType', 'description'])).toBe(
      true,
    );
    expect(safetyScoreFieldsChanged(['status'])).toBe(true);
  });
});

describe('auditActionForOperation', () => {
  it('mapeia operações conhecidas', () => {
    expect(auditActionForOperation('CREATED')).toBe('CIPA_ACCIDENT_CREATE');
    expect(auditActionForOperation('RECLASSIFIED_TO_CONDITION')).toBe(
      'CIPA_ACCIDENT_RECLASSIFY_TO_CONDITION',
    );
    expect(auditActionForOperation('IGNORED_CONDITION')).toBeNull();
  });
});
