import { describe, expect, it } from 'vitest';
import { $Enums } from '../generated/prisma/client.js';
import {
  canAccessProcessCharts,
  canDeclineWorkflowStage,
  canAccessSolicitation,
  canAccessWorkflow,
  canAccessProductionTracking,
  canAssignRole,
  canAssignDepartment,
  canManagePcpStage,
  canManageQualityStage,
  canManageUser,
  canManageSolicitations,
  departmentForAssignedRole,
  solicitationScope,
  canManageSampleStage,
  canManageToolingStage,
  visibleWorkflowStages,
} from './access-policy.js';

describe('direct Commercial tooling access', () => {
  const item = { department: 'FERRAMENTARIA' as const, cardNumber: 'other', unit: 'TRACTOR' as const,
    processInstructionRequester: 'Comercial', workflowStages: [{ stage: 'FERRAMENTARIA' as const }] };
  it.each([
    ['ADMIN', 'COMERCIAL', true], ['ADMIN', 'FERRAMENTARIA', true],
    ['SUPER_ADMIN', null, true], ['ADMIN', 'PCP', false],
    ['ADMIN', 'QUALIDADE', false], ['ADMIN', 'AMOSTRA', false], ['ADMIN', 'DESENVOLVIMENTO_PROCESSOS', false],
  ] as const)('limits access for %s in %s', (role, department, expected) => {
    const actor = { role, department, cardNumber: '123', unit: 'PEDERTRACTOR' as const };
    expect(canAccessSolicitation(actor, item)).toBe(expected);
    if (department === 'COMERCIAL' || department === 'FERRAMENTARIA') {
      expect(solicitationScope(actor)).toMatchObject({ department: { in: ['DESENVOLVIMENTO_PROCESSOS', 'FERRAMENTARIA'] } });
    }
  });
});

describe('commercial production tracking access', () => {
  it('allows Commercial and supervising admins only', () => {
    expect(canAccessProductionTracking({ role: 'ADMIN', department: 'COMERCIAL' })).toBe(true);
    expect(canAccessProductionTracking({ role: 'SUPER_ADMIN', department: null })).toBe(true);
    expect(canAccessProductionTracking({ role: 'ADMIN', department: 'DESENVOLVIMENTO_PROCESSOS' })).toBe(true);
    for (const role of ['USER', 'ADMIN'] as const) {
      expect(canAccessProductionTracking({ role, department: 'AMOSTRA' })).toBe(false);
    }
  });
});

describe('PCP access', () => {
  const pcp = { role: $Enums.UserRole.ADMIN, department: $Enums.UserDepartment.PCP,
    cardNumber: '123', unit: $Enums.Unit.PEDERTRACTOR };
  it('manages PCP and sees commercial workflows, without managing other stages or users', () => {
    expect(canManagePcpStage(pcp)).toBe(true);
    expect(canAccessWorkflow(pcp)).toBe(true);
    expect(canManageToolingStage(pcp)).toBe(false);
    expect(canManageSampleStage(pcp)).toBe(false);
    expect(canManageSolicitations(pcp)).toBe(false);
    expect(canAssignRole(pcp, 'ADMIN')).toBe(false);
    expect(solicitationScope(pcp)).toMatchObject({ department: 'DESENVOLVIMENTO_PROCESSOS', processInstructionRequester: 'Comercial' });
    const solicitation = { department: $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS,
      cardNumber: 'other', unit: $Enums.Unit.PEDERTRACTOR, processInstructionRequester: 'Comercial',
      workflowStages: [{ stage: $Enums.WorkflowStage.ENGENHARIA }] };
    expect(canAccessSolicitation(pcp, solicitation)).toBe(true);
    expect(canAccessSolicitation(pcp, { ...solicitation, processInstructionRequester: 'Engenharia' })).toBe(false);
    expect(canAccessSolicitation(pcp, { ...solicitation, workflowStages: [] })).toBe(false);
  });
  it('can be assigned by Processos admins and remains in Processos', () => {
    const lead = { role: $Enums.UserRole.ADMIN, department: $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS };
    expect(canAssignRole(lead, 'ADMIN')).toBe(true);
    expect(canAssignDepartment(lead, 'ADMIN', 'PCP')).toBe(true);
    expect(canAssignDepartment(lead, 'ADMIN', 'ENG_MECANICA')).toBe(false);
    expect(departmentForAssignedRole('ADMIN', 'ENG_MECANICA', 'PCP')).toBe('PCP');
    expect(canManagePcpStage(lead)).toBe(false);
    expect(canManagePcpStage({ role: 'SUPER_ADMIN', department: null })).toBe(true);
  });
});

describe('Process Engineering lead workflow visibility', () => {
  const lead = {
    role: $Enums.UserRole.ADMIN,
    department: $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS,
  };

  it('only exposes the Engenharia stage', () => {
    expect(visibleWorkflowStages(lead)).toEqual([
      $Enums.WorkflowStage.ENGENHARIA,
    ]);
  });

  it('does not allow managing the sample stage', () => {
    expect(canManageSampleStage(lead)).toBe(false);
  });

  it('keeps sample management for Amostra admins', () => {
    expect(
      canManageSampleStage({
        role: $Enums.UserRole.ADMIN,
        department: $Enums.UserDepartment.AMOSTRA,
      }),
    ).toBe(true);
  });
});

describe('canManageToolingStage', () => {
  it('assigns tooling activities to Ferramentaria admins', () => {
    expect(
      canManageToolingStage({
        role: $Enums.UserRole.ADMIN,
        department: $Enums.UserDepartment.FERRAMENTARIA,
      }),
    ).toBe(true);
  });

  it('does not allow Process Engineering admins to create tooling activities', () => {
    expect(
      canManageToolingStage({
        role: $Enums.UserRole.ADMIN,
        department: $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS,
      }),
    ).toBe(false);
  });

  it('preserves existing process charts access restrictions', () => {
    expect(
      canAccessProcessCharts({
        role: $Enums.UserRole.ADMIN,
        department: $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS,
      }),
    ).toBe(true);
    expect(
      canAccessProcessCharts({
        role: $Enums.UserRole.ADMIN,
        department: $Enums.UserDepartment.ENG_MECANICA,
      }),
    ).toBe(false);
    expect(
      canAccessProcessCharts({
        role: $Enums.UserRole.SUPER_ADMIN,
        department: null,
      }),
    ).toBe(false);
  });

  it('preserves super-admin access', () => {
    expect(
      canManageToolingStage({
        role: $Enums.UserRole.SUPER_ADMIN,
        department: null,
      }),
    ).toBe(true);
  });
});

describe('canAssignDepartment for SUPER_ADMIN', () => {
  it('allows only null department when assigning super admin', () => {
    const actor = {
      role: $Enums.UserRole.SUPER_ADMIN,
      department: null as $Enums.UserDepartment | null,
    };
    expect(
      canAssignDepartment(actor, $Enums.UserRole.SUPER_ADMIN, null),
    ).toBe(true);
    expect(
      canAssignDepartment(
        actor,
        $Enums.UserRole.SUPER_ADMIN,
        $Enums.UserDepartment.ENG_MECANICA,
      ),
    ).toBe(false);
  });
});


describe('Quality access', () => {
  const quality = { role: $Enums.UserRole.ADMIN, department: $Enums.UserDepartment.QUALIDADE,
    cardNumber: '123', unit: $Enums.Unit.PEDERTRACTOR };
  it('operates PPAP with access only to workflows containing Quality', () => {
    expect(canManageQualityStage(quality)).toBe(true);
    expect(canAccessWorkflow(quality)).toBe(true);
    expect(canManageSampleStage(quality)).toBe(false);
    expect(canManagePcpStage(quality)).toBe(false);
    expect(canManageToolingStage(quality)).toBe(false);
    expect(canManageQualityStage({ ...quality, role: 'USER' })).toBe(false);
    expect(canManageQualityStage({ role: 'SUPER_ADMIN', department: null })).toBe(true);
    expect(solicitationScope(quality)).toMatchObject({ workflowStages: { some: { stage: 'QUALIDADE' } } });
    const item = { department: $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS, cardNumber: 'other',
      unit: $Enums.Unit.PEDERTRACTOR, processInstructionRequester: 'Comercial', workflowStages: [{ stage: $Enums.WorkflowStage.QUALIDADE }] };
    expect(canAccessSolicitation(quality, item)).toBe(true);
    expect(canAccessSolicitation(quality, { ...item, workflowStages: [{ stage: 'AMOSTRA' }] })).toBe(false);
  });
  it('allows Processos admins to assign and manage Quality accounts', () => {
    const lead = { role: $Enums.UserRole.ADMIN, department: $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS };
    expect(canAssignDepartment(lead, 'ADMIN', 'QUALIDADE')).toBe(true);
    expect(canManageUser(lead, quality)).toBe(true);
  });
});

describe('stage decline ownership', () => {
  const owners = [
    { role: 'ADMIN', department: 'DESENVOLVIMENTO_PROCESSOS', stages: ['ENGENHARIA'] },
    { role: 'ADMIN', department: 'PCP', stages: ['PCP_FERRAMENTARIA', 'PCP_AMOSTRA'] },
    { role: 'ADMIN', department: 'FERRAMENTARIA', stages: ['FERRAMENTARIA'] },
    { role: 'ADMIN', department: 'QUALIDADE', stages: ['QUALIDADE'] },
    { role: 'ADMIN', department: 'AMOSTRA', stages: ['AMOSTRA'] },
    { role: 'ADMIN', department: 'COMERCIAL', stages: [] },
    { role: 'USER', department: 'DESENVOLVIMENTO_PROCESSOS', stages: [] },
    { role: 'ADMIN', department: 'ENG_MECANICA', stages: [] },
  ] as const;
  for (const owner of owners) for (const stage of Object.values($Enums.WorkflowStage)) {
    it(`${owner.role}/${owner.department} decline ${stage}`, () => {
      expect(canDeclineWorkflowStage(owner, stage)).toBe((owner.stages as readonly string[]).includes(stage));
      expect(canDeclineWorkflowStage({ role: 'SUPER_ADMIN', department: null }, stage)).toBe(false);
    });
  }
});

it('never grants stage decline to a super admin, even with a matching department', () => {
  for (const department of Object.values($Enums.UserDepartment)) {
    for (const stage of Object.values($Enums.WorkflowStage)) {
      expect(canDeclineWorkflowStage({ role: 'SUPER_ADMIN', department }, stage)).toBe(false);
    }
  }
});


describe('PCP and Commercial department security matrix', () => {
  for (const role of ['USER', 'ADMIN', 'SUPER_ADMIN'] as const) {
    for (const department of [null, ...Object.values($Enums.UserDepartment)]) {
      it(role + ' / ' + department, () => {
        const actor = { role, department, cardNumber: 'owner', unit: 'TRACTOR' as const };
        expect(canManagePcpStage(actor)).toBe(role === 'SUPER_ADMIN' || role === 'ADMIN' && department === 'PCP');
        expect(canAccessProductionTracking(actor)).toBe(role === 'SUPER_ADMIN' || role === 'ADMIN' && ['COMERCIAL', 'DESENVOLVIMENTO_PROCESSOS'].includes(department ?? ''));
        if (department === 'PCP' || department === 'COMERCIAL') {
          expect(canManageSolicitations(actor)).toBe(role === 'SUPER_ADMIN');
          expect(canManageUser(actor, { role: 'ADMIN', department: 'ENG_MECANICA' })).toBe(role === 'SUPER_ADMIN');
          expect(canAssignRole(actor, 'SUPER_ADMIN')).toBe(role === 'SUPER_ADMIN');
          expect(canAssignDepartment(actor, 'ADMIN', 'DESENVOLVIMENTO_PROCESSOS')).toBe(role === 'SUPER_ADMIN');
          if (role === 'USER') {
            expect(canAccessWorkflow(actor)).toBe(false);
            expect(solicitationScope(actor)).toEqual({ department, cardNumber: 'owner', unit: 'TRACTOR' });
            expect(canAccessSolicitation(actor, { department, cardNumber: 'other', unit: 'TRACTOR' })).toBe(false);
          }
        }
      });
    }
  }
});


describe('Commercial indicators access', () => {
  it.each(['USER', 'ADMIN', 'SUPER_ADMIN'] as const)('limits Commercial indicators for %s', (role) => {
    expect(canAccessProcessCharts({ role, department: 'COMERCIAL' })).toBe(role === 'ADMIN');
    expect(canAccessProcessCharts({ role, department: 'PCP' })).toBe(false);
  });
});
