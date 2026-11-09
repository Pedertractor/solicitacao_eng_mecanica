import { describe, expect, it } from 'vitest';
import { workflowPrerequisitesDone, type WorkflowDependencyStage } from './workflow-dependencies.js';

describe('parallel workflow join', () => {
  it('starts tooling immediately and releases PCP only after tooling in the new flow', () => {
    const stages: WorkflowDependencyStage[] = [
      { stage: 'ENGENHARIA', status: 'IN_PROGRESS', order: 0 }, { stage: 'FERRAMENTARIA', status: 'READY', order: 1 },
      { stage: 'PCP_AMOSTRA', status: 'PENDING', order: 3 }, { stage: 'QUALIDADE', status: 'DONE', order: 4 },
      { stage: 'PCP_FERRAMENTARIA', status: 'PENDING', order: 2 },
    ];
    expect(workflowPrerequisitesDone(stages, 'FERRAMENTARIA', true)).toBe(true);
    expect(workflowPrerequisitesDone(stages, 'PCP_AMOSTRA', true)).toBe(false);
    expect(workflowPrerequisitesDone(stages, 'PCP_FERRAMENTARIA', true)).toBe(false);
    stages[1]!.status = 'DONE';
    expect(workflowPrerequisitesDone(stages, 'PCP_FERRAMENTARIA', true)).toBe(true);
    expect(workflowPrerequisitesDone(stages, 'PCP_AMOSTRA', true)).toBe(false);
    stages[4]!.status = 'DONE';
    expect(workflowPrerequisitesDone(stages, 'PCP_AMOSTRA', true)).toBe(true);
    expect(workflowPrerequisitesDone(stages, 'AMOSTRA', true)).toBe(false);
    stages[0]!.status = 'DONE';
    stages[2]!.status = 'DONE';
    expect(workflowPrerequisitesDone(stages, 'AMOSTRA', true)).toBe(true);
  });
  const kinds = ['ENGENHARIA', 'PCP_FERRAMENTARIA', 'FERRAMENTARIA', 'PCP_AMOSTRA', 'QUALIDADE'] as const;
  for (let mask = 0; mask < 32; mask++) {
    it(`requires all five predecessors before Amostra (completion mask ${mask})`, () => {
      const stages: WorkflowDependencyStage[] = kinds.map((stage, i) => ({ stage, status: mask & (1 << i) ? 'DONE' : 'IN_PROGRESS' }));
      expect(workflowPrerequisitesDone(stages, 'AMOSTRA', true)).toBe(mask === 31);
    });
  }
  it('makes Quality independent and preserves workflows without Quality', () => {
    expect(workflowPrerequisitesDone([{ stage: 'QUALIDADE', status: 'READY' }], 'QUALIDADE', true)).toBe(true);
    expect(workflowPrerequisitesDone([
      { stage: 'ENGENHARIA', status: 'DONE' }, { stage: 'PCP_AMOSTRA', status: 'DONE' },
    ], 'AMOSTRA', false)).toBe(true);
    expect(workflowPrerequisitesDone([
      { stage: 'ENGENHARIA', status: 'DONE' }, { stage: 'PCP_AMOSTRA', status: 'DONE' },
      { stage: 'QUALIDADE', status: 'CANCELLED' },
    ], 'AMOSTRA', false)).toBe(false);
  });
  it('allows tooling after PCP even while engineering is open', () => {
    expect(workflowPrerequisitesDone([
      { stage: 'ENGENHARIA', status: 'IN_PROGRESS' }, { stage: 'PCP_FERRAMENTARIA', status: 'DONE' },
    ], 'FERRAMENTARIA', true)).toBe(true);
  });
  it('does not treat a cancelled or missing prerequisite as completed', () => {
    expect(workflowPrerequisitesDone([{ stage: 'PCP_AMOSTRA', status: 'DONE' }], 'AMOSTRA', false)).toBe(false);
    expect(workflowPrerequisitesDone([
      { stage: 'ENGENHARIA', status: 'CANCELLED' }, { stage: 'PCP_AMOSTRA', status: 'DONE' },
    ], 'AMOSTRA', false)).toBe(false);
  });
});

it('accepts each declined prerequisite without bypassing other branches', () => {
  const kinds = ['ENGENHARIA', 'PCP_FERRAMENTARIA', 'FERRAMENTARIA', 'PCP_AMOSTRA', 'QUALIDADE'] as const;
  for (const rejected of kinds) {
    const stages: WorkflowDependencyStage[] = kinds.map((stage) => ({ stage, status: stage === rejected ? 'REJECTED' : 'DONE' }));
    expect(workflowPrerequisitesDone(stages, 'AMOSTRA', true)).toBe(true);
    const open = stages.find((stage) => stage.stage !== rejected)!;
    open.status = 'IN_PROGRESS';
    expect(workflowPrerequisitesDone(stages, 'AMOSTRA', true)).toBe(false);
  }
});
