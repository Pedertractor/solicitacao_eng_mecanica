import { describe, expect, it } from 'vitest';
import type { SolicitationWorkflow, WorkflowStageItem } from '@/services/solicitation';
import { currentProductionStages, deliveryDeadline, productionType } from './production-tracking';

describe('commercial production tracking', () => {
  it('includes the request type before product classification has been entered', () => {
    expect(productionType({ processInstructionType: 'Desenvolvimento Amostra', productType: null })).toBe('AMOSTRA');
    expect(productionType({ processInstructionType: 'Desenvolvimento Protótipo', productType: null })).toBe('PROTOTIPO');
    expect(productionType({ processInstructionType: null, productType: 'PROTOTIPO' })).toBe('PROTOTIPO');
  });

  it('uses the São Paulo calendar day for delivery deadlines, including around midnight UTC', () => {
    const now = new Date('2026-10-28T01:30:00Z'); // 27/10 in São Paulo
    expect(deliveryDeadline('2026-10-27T00:00:00Z', now)).toMatchObject({ days: 0, tone: 'today' });
    expect(deliveryDeadline('2026-10-26T00:00:00Z', now)).toMatchObject({ days: -1, tone: 'late' });
    expect(deliveryDeadline('2026-10-29T00:00:00Z', now)).toMatchObject({ days: 2, tone: 'normal' });
    expect(deliveryDeadline(null, now)).toMatchObject({ days: null, tone: 'none' });
  });

  it('shows concurrent work without presenting blocked sample stages as current', () => {
    const stage = (kind: WorkflowStageItem['stage'], status: WorkflowStageItem['status'], order: number) => ({ stage: kind, status, order } as WorkflowStageItem);
    const workflow: SolicitationWorkflow = { requiresTooling: false, stages: [
      stage('ENGENHARIA', 'IN_PROGRESS', 0), stage('PCP_AMOSTRA', 'PENDING', 1),
      stage('QUALIDADE', 'READY', 2), stage('AMOSTRA', 'PENDING', 3),
    ] };
    expect(currentProductionStages({ workflow }).map((item) => item.stage)).toEqual(['ENGENHARIA', 'QUALIDADE']);
    workflow.stages[0].status = 'DONE';
    expect(currentProductionStages({ workflow }).map((item) => item.stage)).toEqual(['PCP_AMOSTRA', 'QUALIDADE']);
    workflow.stages[1].status = 'DONE';
    workflow.stages[2].status = 'REJECTED';
    expect(currentProductionStages({ workflow }).map((item) => item.stage)).toEqual(['AMOSTRA']);
    workflow.stages[3].status = 'DONE';
    expect(currentProductionStages({ workflow })).toEqual([]);
  });
});
