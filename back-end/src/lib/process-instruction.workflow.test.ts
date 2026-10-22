import { describe, expect, it } from 'vitest';
import {
  calcularDataLimiteDate,
  calcularDataLimiteVintePorCentoDate,
  engineeringStagePlannedEndAt,
  isComercialWorkflow,
  WORKFLOW_ENGINEERING_PERCENTAGE,
} from './process-instruction.js';

describe('isComercialWorkflow', () => {
  it('returns true for processos + Comercial', () => {
    expect(
      isComercialWorkflow('DESENVOLVIMENTO_PROCESSOS', 'Comercial'),
    ).toBe(true);
  });

  it('returns false for other requesters or departments', () => {
    expect(isComercialWorkflow('ENG_MECANICA', 'Comercial')).toBe(false);
    expect(
      isComercialWorkflow('DESENVOLVIMENTO_PROCESSOS', 'Engenharia'),
    ).toBe(false);
    expect(isComercialWorkflow('DESENVOLVIMENTO_PROCESSOS', null)).toBe(false);
  });
});

describe('20% business-day helpers', () => {
  it('uses WORKFLOW_ENGINEERING_PERCENTAGE = 20', () => {
    expect(WORKFLOW_ENGINEERING_PERCENTAGE).toBe(20);
  });

  it('calculates business-day date for fixed deadlines', () => {
    // Monday 2026-10-12
    const now = new Date(2026, 9, 12);
    const result = calcularDataLimiteDate(5, now);
    expect(result).not.toBeNull();
    // 5 business days from Mon 12 -> Mon 19
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(9);
    expect(result!.getDate()).toBe(19);
  });

  it('calculates 20% of business days until delivery', () => {
    // Monday 2026-10-12, delivery Friday 2026-10-23 => 10 business days => 20% = 2
    const now = new Date(2026, 9, 12);
    const calc = calcularDataLimiteVintePorCentoDate('2026-10-23', now);
    expect(calc.diasUteis).toBe(2);
    expect(calc.dataLimite).not.toBeNull();
    expect(calc.dataLimite!.getDate()).toBe(14);
  });

  it('uses 20% rule for Comercial/Engenharia/Desenvolvimento Amostra with delivery date', () => {
    const now = new Date(2026, 9, 12);
    const planned = engineeringStagePlannedEndAt({
      requester: 'Comercial',
      process: 'Engenharia',
      type: 'Desenvolvimento Amostra',
      deliveryDateIso: '2026-10-23',
      now,
    });
    expect(planned).not.toBeNull();
    expect(planned!.getDate()).toBe(14);
  });

  it('uses fixed deadline for Comercial/Corte/Simulação Comercial', () => {
    const now = new Date(2026, 9, 12);
    const planned = engineeringStagePlannedEndAt({
      requester: 'Comercial',
      process: 'Corte',
      type: 'Simulação Comercial',
      deliveryDateIso: null,
      now,
    });
    // 10 business days from Mon 12 -> Mon 26
    expect(planned).not.toBeNull();
    expect(planned!.getDate()).toBe(26);
  });
});
