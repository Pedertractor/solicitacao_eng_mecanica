import { describe, expect, it } from 'vitest';
import { $Enums } from '../generated/prisma/client.js';
import { WorkflowService } from './workflow-service.js';

describe('WorkflowService.buildStagesForCreate', () => {
  const service = new WorkflowService();
  const now = new Date(2026, 9, 12);
  it('creates ready tooling only, due in ten business days, for the new destination', () => {
    expect(service.buildStagesForCreate({ department: 'FERRAMENTARIA', requester: 'Comercial',
      process: '', type: 'Simulação Comercial', requiresTooling: true, directTooling: true,
      deliveryDateIso: null, now })).toEqual([{ stage: 'FERRAMENTARIA', status: 'READY', order: 0,
        plannedStartAt: now, plannedEndAt: new Date(2026, 9, 26) }]);
  });

  it('creates only PCP and Ferramentaria for the direct route', () => {
    expect(service.buildStagesForCreate({
      requester: 'Comercial', process: 'Engenharia', type: 'Desenvolvimento Amostra',
      deliveryDateIso: null, requiresTooling: true, directTooling: true, now,
    })).toEqual([
      { stage: 'PCP_FERRAMENTARIA', order: 0, status: 'READY' },
      { stage: 'FERRAMENTARIA', order: 1, status: 'PENDING' },
    ]);
  });

  it('creates only Engenharia for a commercial simulation', () => {
    const stages = service.buildStagesForCreate({
      requester: 'Comercial',
      process: 'Corte',
      type: 'Simulação Comercial',
      deliveryDateIso: null,
      requiresTooling: false,
      now,
    });

    expect(stages.map((stage) => stage.stage)).toEqual([
      $Enums.WorkflowStage.ENGENHARIA,
    ]);
    expect(stages[0]!.plannedDurationPercentage).toBe(20);
    expect(stages[0]!.plannedEndAt).not.toBeNull();
    expect(stages).toHaveLength(1);
  });

  it('includes Ferramentaria when requiresTooling is true', () => {
    const stages = service.buildStagesForCreate({
      requester: 'Comercial',
      process: 'Engenharia',
      type: 'Desenvolvimento Amostra',
      deliveryDateIso: '2026-10-23',
      requiresTooling: true,
      now,
    });

    expect(stages.map((stage) => stage.stage)).toEqual([
      $Enums.WorkflowStage.ENGENHARIA,
      $Enums.WorkflowStage.FERRAMENTARIA,
      $Enums.WorkflowStage.PCP_FERRAMENTARIA,
      $Enums.WorkflowStage.PCP_AMOSTRA,
      $Enums.WorkflowStage.QUALIDADE,
      $Enums.WorkflowStage.AMOSTRA,
    ]);
    expect(stages.find((stage) => stage.stage === 'QUALIDADE')).toMatchObject({ status: 'READY', order: stages.length - 2 });
    expect(stages[1]!.order).toBe(1);
    expect(stages[2]!.order).toBe(2);
    expect(stages[1]!.status).toBe('READY');
    expect(stages[2]!.status).toBe('PENDING');
    expect(stages[1]!.stage).toBe('FERRAMENTARIA');
    expect(stages[2]!.stage).toBe('PCP_FERRAMENTARIA');
    expect(stages[3]!.stage).toBe('PCP_AMOSTRA');
  });
});
