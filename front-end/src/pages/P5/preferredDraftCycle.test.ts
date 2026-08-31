import { describe, expect, it } from 'vitest';
import { preferredDraftCycle } from './preferredDraftCycle';
import type { MonthlyCycle } from '@/services/p5';

function draft(id: string, month: number, year: number): MonthlyCycle {
  return {
    id,
    month,
    year,
    status: 'DRAFT',
  } as MonthlyCycle;
}

describe('preferredDraftCycle', () => {
  it('escolhe o mês calendário atual quando ainda está em rascunho', () => {
    const drafts = [
      draft('feb', 2, 2026),
      draft('aug', 8, 2026),
      draft('sep', 9, 2026),
    ];
    expect(preferredDraftCycle(drafts, new Date(2026, 7, 19))?.id).toBe('aug');
  });

  it('cai no primeiro rascunho quando o mês atual já não está disponível', () => {
    const drafts = [draft('feb', 2, 2026), draft('mar', 3, 2026)];
    expect(preferredDraftCycle(drafts, new Date(2026, 7, 19))?.id).toBe('feb');
  });

  it('retorna null quando não há rascunhos', () => {
    expect(preferredDraftCycle([], new Date(2026, 7, 19))).toBeNull();
  });
});
