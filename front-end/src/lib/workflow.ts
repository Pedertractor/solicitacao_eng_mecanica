import type { SolicitationWorkflow, WorkflowStageKind } from '@/services/solicitation';

export function workflowPrerequisites(workflow: SolicitationWorkflow, stage: WorkflowStageKind): WorkflowStageKind[] {
  const hasPcp = workflow.stages.some((item) => item.stage.startsWith('PCP_'));
  const tooling = workflow.stages.find((item) => item.stage === 'FERRAMENTARIA');
  const toolingPcp = workflow.stages.find((item) => item.stage === 'PCP_FERRAMENTARIA');
  const toolingFirst = tooling != null && toolingPcp != null && tooling.order < toolingPcp.order;
  switch (stage) {
    case 'QUALIDADE':
    case 'ENGENHARIA':
      return [];
    case 'PCP_FERRAMENTARIA': return toolingFirst ? ['FERRAMENTARIA'] : [];
    case 'FERRAMENTARIA':
      if (workflow.kind === 'COMMERCIAL_SIMULATION' || workflow.kind === 'COMMERCIAL_DIRECT_TOOLING') return [];
      if (toolingFirst) return [];
      if (workflow.stages.some((item) => item.stage === 'PCP_FERRAMENTARIA')) return ['PCP_FERRAMENTARIA'];
      return hasPcp ? [] : ['ENGENHARIA'];
    case 'PCP_AMOSTRA': return workflow.requiresTooling && toolingFirst
      ? ['FERRAMENTARIA', 'PCP_FERRAMENTARIA'] : [workflow.requiresTooling ? 'FERRAMENTARIA' : 'ENGENHARIA'];
    case 'AMOSTRA': return [
      'ENGENHARIA',
      ...(workflow.stages.some((item) => item.stage === 'QUALIDADE') ? ['QUALIDADE' as const] : []),
      ...(workflow.requiresTooling ? ['FERRAMENTARIA' as const] : []),
      ...(hasPcp ? [...(workflow.requiresTooling && workflow.stages.some((item) => item.stage === 'PCP_FERRAMENTARIA') ? ['PCP_FERRAMENTARIA' as const] : []), 'PCP_AMOSTRA' as const] : []),
    ];
  }
}

export function workflowPrerequisitesDone(workflow: SolicitationWorkflow, stage: WorkflowStageKind) {
  return workflowPrerequisites(workflow, stage).every((dependency) =>
    workflow.stages.some((item) => item.stage === dependency && ['DONE', 'REJECTED'].includes(item.status)));
}

export function workflowCanStart(workflow: SolicitationWorkflow, stage: WorkflowStageKind) {
  const item = workflow.stages.find((candidate) => candidate.stage === stage);
  return item != null && ['READY', 'PENDING'].includes(item.status)
    && workflowPrerequisitesDone(workflow, stage);
}
