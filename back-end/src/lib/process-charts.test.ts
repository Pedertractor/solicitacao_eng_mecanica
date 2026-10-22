import { describe, expect, it } from 'vitest';
import {
  buildProcessCharts,
  calendarDateInSaoPaulo,
  periodRange,
  shortPersonName,
  toChartCase,
} from './process-charts.js';

describe('process charts', () => {
  it('formats client and person labels like the dashboard', () => {
    expect(toChartCase('CNH - PIRACICABA')).toBe('Cnh - Piracicaba');
    expect(toChartCase('PRAMAC GERADORES')).toBe('Pramac Geradores');
    expect(shortPersonName('Cassiano Martins')).toBe('Cassiano M.');
    expect(shortPersonName('Matheus Vieira')).toBe('Matheus V.');
  });

  it('uses São Paulo calendar bounds for year, month and week', () => {
    const now = new Date('2026-10-14T12:00:00.000Z');

    expect(periodRange('month', now)).toEqual({
      start: new Date('2026-10-01T03:00:00.000Z'),
      end: new Date('2026-11-01T03:00:00.000Z'),
    });
    expect(periodRange('year', now)).toEqual({
      start: new Date('2026-01-01T03:00:00.000Z'),
      end: new Date('2027-01-01T03:00:00.000Z'),
    });
    expect(periodRange('week', now)).toEqual({
      start: new Date('2026-10-12T03:00:00.000Z'),
      end: new Date('2026-10-19T03:00:00.000Z'),
    });
    expect(periodRange('week', new Date('2026-10-01T15:00:00.000Z'))).toEqual({
      start: new Date('2026-09-28T03:00:00.000Z'),
      end: new Date('2026-10-05T03:00:00.000Z'),
    });
  });

  it('anchors year, month and week to a chosen São Paulo calendar date', () => {
    expect(periodRange('month', calendarDateInSaoPaulo('2025-03-10')!)).toEqual({
      start: new Date('2025-03-01T03:00:00.000Z'),
      end: new Date('2025-04-01T03:00:00.000Z'),
    });
    expect(periodRange('year', calendarDateInSaoPaulo('2024-11-02')!)).toEqual({
      start: new Date('2024-01-01T03:00:00.000Z'),
      end: new Date('2025-01-01T03:00:00.000Z'),
    });
    expect(periodRange('week', calendarDateInSaoPaulo('2026-01-01')!)).toEqual({
      start: new Date('2025-12-29T03:00:00.000Z'),
      end: new Date('2026-01-05T03:00:00.000Z'),
    });
    expect(calendarDateInSaoPaulo('2026-02-31')).toBeNull();
  });

  it('counts pedidos by client, activity type and responsible', () => {
    const charts = buildProcessCharts([
      {
        client: 'CNH_PIRACICABA',
        processInstructionType: 'Alteração Interna',
        requesterName: 'Cassiano Martins',
      },
      {
        client: 'CNH_PIRACICABA',
        processInstructionType: 'Desenvolvimento Amostra',
        requesterName: 'Cassiano Martins',
      },
      {
        client: 'JACTO',
        processInstructionType: 'Alteração Cliente',
        requesterName: 'Pedro Vieira',
      },
    ]);

    expect(charts.byClient).toEqual([
      { key: 'CNH_PIRACICABA', label: 'Cnh - Piracicaba', count: 2 },
      { key: 'JACTO', label: 'Jacto', count: 1 },
    ]);
    expect(charts.byActivityType.map((item) => item.label)).toEqual([
      'Alteração Cliente',
      'Alteração Interna',
      'Desenv. De Amostras',
    ]);
    expect(charts.byResponsible[0]).toEqual({
      key: 'Cassiano M.',
      label: 'Cassiano M.',
      count: 2,
    });
  });
});
