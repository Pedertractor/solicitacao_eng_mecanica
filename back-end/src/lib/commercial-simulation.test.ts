import { describe, expect, it } from 'vitest';
import { workflowKind } from './commercial-simulation.js';
import { simulationConversionEligibility } from './simulation-conversion.js';
import { workflowPrerequisitesDone } from './workflow-dependencies.js';

const base = { department: 'DESENVOLVIMENTO_PROCESSOS', processInstructionRequester: 'Comercial',
  processInstructionType: 'Simulação Comercial', status: 'APPROVED', workflowStages: [
    { stage: 'ENGENHARIA', status: 'IN_PROGRESS' }, { stage: 'PCP_AMOSTRA', status: 'PENDING' },
  ] };

describe('commercial simulation and conversion', () => {
  it('releases a single tooling stage only for the new direct destination', () => {
    const direct = { ...base, department: 'FERRAMENTARIA', workflowStages: [{ stage: 'FERRAMENTARIA', status: 'READY' }] };
    expect(workflowKind(direct)).toBe('COMMERCIAL_DIRECT_TOOLING');
    expect(workflowPrerequisitesDone([{ stage: 'FERRAMENTARIA', status: 'READY' }], 'FERRAMENTARIA', true, workflowKind(direct))).toBe(true);
    expect(workflowKind({ ...direct, department: 'DESENVOLVIMENTO_PROCESSOS' })).toBe('STANDARD');
    expect(simulationConversionEligibility(direct).eligible).toBe(false);
  });
  it('distinguishes preserved legacy workflows and other destinations from the new mode', () => {
    expect(workflowKind(base)).toBe('STANDARD');
    const converted = { ...base, workflowStages: [{ stage: 'ENGENHARIA', status: 'PENDING' }] };
    expect(workflowKind(converted)).toBe('COMMERCIAL_SIMULATION');
    expect(workflowKind({ ...converted, department: 'ENG_MECANICA' })).toBe('STANDARD');
    expect(workflowKind({ ...converted, processInstructionRequester: 'Ferramentaria' })).toBe('STANDARD');
    expect(workflowKind({ ...converted, processInstructionType: 'Desenvolvimento Amostra' })).toBe('STANDARD');
  });

  it('allows tooling in parallel only in the new mode', () => {
    const stages = [{ stage: 'ENGENHARIA', status: 'IN_PROGRESS' }, { stage: 'FERRAMENTARIA', status: 'READY' }] as const;
    expect(workflowPrerequisitesDone([...stages], 'FERRAMENTARIA', true, 'COMMERCIAL_SIMULATION')).toBe(true);
    expect(workflowPrerequisitesDone([...stages], 'FERRAMENTARIA', true)).toBe(false);
  });

  it('converts untouched downstream stages and preserves already converted flows', () => {
    expect(simulationConversionEligibility(base).eligible).toBe(true);
    expect(simulationConversionEligibility({ ...base, workflowStages: [base.workflowStages[0]!] }).eligible).toBe(false);
  });

  it.each(['COMPLETED', 'CANCELLED', 'DELETED'])('preserves %s requests', (status) => {
    expect(simulationConversionEligibility({ ...base, status }).eligible).toBe(false);
  });

  it.each([
    { status: 'IN_PROGRESS' }, { status: 'DONE' }, { status: 'REJECTED' }, { status: 'CANCELLED' },
    { actualStartAt: new Date() }, { actualEndAt: new Date() }, { kairoCardIds: 'card' },
    { kairoTeamId: 'team' }, { kairoSyncedAt: new Date() }, { rejectedByUserId: 'user' },
    { rejectionReason: 'reason' }, { completedByUserId: 'user' },
  ])('preserves recorded downstream work: %o', (work) => {
    expect(simulationConversionEligibility({ ...base, workflowStages: [base.workflowStages[0]!,
      { stage: 'FERRAMENTARIA', status: 'READY', ...work }] }).eligible).toBe(false);
  });

  it('preserves direct flows without engineering', () => {
    expect(simulationConversionEligibility({ ...base, workflowStages: [{ stage: 'FERRAMENTARIA', status: 'PENDING' }] }).eligible).toBe(false);
  });
});
