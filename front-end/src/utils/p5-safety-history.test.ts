import { describe, expect, it } from 'vitest';
import {
  formatHistoryActor,
  formatHistoryChangedFields,
  safetyHistoryActionLabel,
} from './p5-safety-history';

describe('p5-safety-history', () => {
  it('traduz ações conhecidas', () => {
    expect(safetyHistoryActionLabel('CIPA_ACCIDENT_CREATE')).toBe(
      'Acidente criado',
    );
    expect(safetyHistoryActionLabel('UNKNOWN')).toBe('UNKNOWN');
  });

  it('formata autor externo', () => {
    expect(
      formatHistoryActor({
        actor: { name: 'Maria', identifier: '5487' },
      }),
    ).toBe('Maria (5487)');
  });

  it('formata campos alterados', () => {
    expect(formatHistoryChangedFields(['status', 'accidentType'])).toBe(
      'status, accidentType',
    );
    expect(formatHistoryChangedFields([])).toBe('—');
  });
});
