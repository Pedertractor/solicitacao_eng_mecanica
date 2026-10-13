import { describe, expect, it } from 'vitest';
import { $Enums } from '../generated/prisma/client.js';
import { WorkflowService } from './workflow-service.js';

describe('WorkflowService.buildStagesForCreate', () => {
  const service = new WorkflowService();
  const now = new Date(2026, 9, 12);

  it('creates Engenharia + Amostra without tooling', () => {
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
      $Enums.WorkflowStage.AMOSTRA,
    ]);
    expect(stages[0]!.plannedDurationPercentage).toBe(20);
    expect(stages[0]!.plannedEndAt).not.toBeNull();
    expect(stages[1]!.order).toBe(1);
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
      $Enums.WorkflowStage.AMOSTRA,
    ]);
    expect(stages[1]!.order).toBe(1);
    expect(stages[2]!.order).toBe(2);
  });
});
