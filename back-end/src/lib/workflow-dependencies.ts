import type { WorkflowKind } from './commercial-simulation.js';
import { $Enums } from '../generated/prisma/client.js';

export type WorkflowDependencyStage = {
  stage: $Enums.WorkflowStage;
  status: $Enums.WorkflowStageStatus;
  order?: number;
};

export const PCP_STAGES = ['PCP_FERRAMENTARIA', 'PCP_AMOSTRA'] as const;
export type PcpStage = (typeof PCP_STAGES)[number];

export function workflowPrerequisites(
  stages: WorkflowDependencyStage[],
  stage: $Enums.WorkflowStage,
  requiresTooling: boolean,
  kind: WorkflowKind = 'STANDARD',
): $Enums.WorkflowStage[] {
  // Closed historical workflows retain their original sequence.
  const hasPcp = stages.some((item) => PCP_STAGES.some((pcp) => pcp === item.stage));
  const tooling = stages.find((item) => item.stage === 'FERRAMENTARIA');
  const toolingPcp = stages.find((item) => item.stage === 'PCP_FERRAMENTARIA');
  const toolingFirst = tooling?.order != null && toolingPcp?.order != null && tooling.order < toolingPcp.order;
  switch (stage) {
    case 'QUALIDADE':
    case 'ENGENHARIA':
      return [];
    case 'PCP_FERRAMENTARIA':
      return toolingFirst ? ['FERRAMENTARIA'] : [];
    case 'FERRAMENTARIA':
      if (kind === 'COMMERCIAL_SIMULATION' || kind === 'COMMERCIAL_DIRECT_TOOLING') return [];
      if (toolingFirst) return [];
      if (stages.some((item) => item.stage === 'PCP_FERRAMENTARIA')) return ['PCP_FERRAMENTARIA'];
      return hasPcp ? [] : ['ENGENHARIA'];
    case 'PCP_AMOSTRA':
      if (requiresTooling && toolingFirst) return ['FERRAMENTARIA', 'PCP_FERRAMENTARIA'];
      return [requiresTooling ? 'FERRAMENTARIA' : 'ENGENHARIA'];
    case 'AMOSTRA':
      return [
        'ENGENHARIA',
        ...(stages.some((item) => item.stage === 'QUALIDADE') ? ['QUALIDADE' as const] : []),
        ...(requiresTooling ? ['FERRAMENTARIA' as const] : []),
        ...(hasPcp
          ? [...(requiresTooling && stages.some((item) => item.stage === 'PCP_FERRAMENTARIA') ? ['PCP_FERRAMENTARIA' as const] : []), 'PCP_AMOSTRA' as const]
          : []),
      ];
  }
}

export function workflowPrerequisitesDone(
  stages: WorkflowDependencyStage[],
  stage: $Enums.WorkflowStage,
  requiresTooling: boolean,
  kind: WorkflowKind = 'STANDARD',
): boolean {
  return workflowPrerequisites(stages, stage, requiresTooling, kind).every(
    (dependency) => stages.some((item) => item.stage === dependency && ['DONE', 'REJECTED'].includes(item.status)),
  );
}
