import { describe, expect, it } from 'vitest';
import { mapAbsenteeismRow } from './absenteeism.js';

describe('mapAbsenteeismRow', () => {
  it('mapeia colunas da procedure para o contrato da API', () => {
    expect(
      mapAbsenteeismRow({
        EMPRESA: 'PEDERTRACTOR',
        CRACHA: 17,
        NOME: 'LUIS FERNANDO UGUCIONI TOZATO',
        SITUACAO: 'Trabalhando',
        DT_REF: new Date('2026-07-01T03:00:00.000Z'),
        ABSENTEISMO: 103.31,
      }),
    ).toEqual({
      company: 'PEDERTRACTOR',
      cardNumber: 17,
      name: 'LUIS FERNANDO UGUCIONI TOZATO',
      situation: 'Trabalhando',
      referenceDate: '2026-07-01T03:00:00.000Z',
      absenteeism: 103.31,
    });
  });
});
