export type WorkflowKind = 'COMMERCIAL_SIMULATION' | 'COMMERCIAL_DIRECT_TOOLING' | 'STANDARD';

export function isCommercialSimulation(row: {
  department?: string | undefined;
  processInstructionRequester?: string | null | undefined;
  processInstructionType?: string | null | undefined;
}) {
  return row.department === 'DESENVOLVIMENTO_PROCESSOS'
    && row.processInstructionRequester?.trim() === 'Comercial'
    && row.processInstructionType?.trim() === 'Simulação Comercial';
}

export function workflowKind(row: Parameters<typeof isCommercialSimulation>[0] & {
  workflowStages?: ReadonlyArray<{ stage: string }>;
}): WorkflowKind {
  const stages = row.workflowStages ?? [];
  if (row.department === 'FERRAMENTARIA'
    && row.processInstructionRequester === 'Comercial'
    && row.processInstructionType === 'Simulação Comercial'
    && stages.length === 1 && stages[0]?.stage === 'FERRAMENTARIA') {
    return 'COMMERCIAL_DIRECT_TOOLING';
  }
  return isCommercialSimulation(row)
    && stages.some((stage) => stage.stage === 'ENGENHARIA')
    && stages.every((stage) => ['ENGENHARIA', 'FERRAMENTARIA'].includes(stage.stage))
    ? 'COMMERCIAL_SIMULATION' : 'STANDARD';
}
