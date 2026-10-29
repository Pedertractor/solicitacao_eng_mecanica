import { describe, expect, it } from 'vitest';
import {
  assignableDepartments,
  canDeclineWorkflowStage,
  assignableRoles,
  canAccessWorkflow,
  canManagePcpStage,
  canManageQualityStage,
  canManageSolicitations,
  isWorkflowOnlyRole,
  canAccessOfTracking,
  canAccessProcessCharts,
  canManageSampleStage,
  canManageToolingStage,
  isProcessEngineeringLead,
} from './permissions';
import { canRoleAccessPath, getHomePathForRole, getSidebarNavItemsForRole } from './roleAccess';

describe('samples and prototypes tracking access', () => {
  it('is available to Commercial, super admin and the Processos admin', () => {
    for (const role of ['COMERCIAL', 'SUPER_ADMIN'] as const) {
      expect(canRoleAccessPath(role, '/amostras-prototipos')).toBe(true);
      expect(getSidebarNavItemsForRole(role).map((item) => item.path)).toContain('/amostras-prototipos');
    }
    expect(canRoleAccessPath('ADMIN', '/amostras-prototipos', 'DESENVOLVIMENTO_PROCESSOS')).toBe(true);
  });
  it('protects direct navigation and hides the sidebar item from other roles', () => {
    for (const role of ['USER', 'PCP', 'ADMIN'] as const) {
      expect(canRoleAccessPath(role, '/amostras-prototipos', 'AMOSTRA')).toBe(false);
      expect(getSidebarNavItemsForRole(role, 'AMOSTRA').map((item) => item.path)).not.toContain('/amostras-prototipos');
    }
  });
});

describe('PCP role', () => {
  it('can be assigned under Processos and opens the commercial workflow', () => {
    expect(assignableRoles('SUPER_ADMIN')).toContain('PCP');
    expect(assignableRoles('ADMIN', 'DESENVOLVIMENTO_PROCESSOS')).toContain('PCP');
    expect(assignableRoles('ADMIN', 'ENG_MECANICA')).not.toContain('PCP');
    expect(assignableDepartments('SUPER_ADMIN', null, 'PCP')).toEqual(['DESENVOLVIMENTO_PROCESSOS']);
    expect(isWorkflowOnlyRole('PCP')).toBe(true);
    expect(canAccessWorkflow('PCP')).toBe(true);
    expect(getHomePathForRole('PCP')).toBe('/workflow');
    expect(getSidebarNavItemsForRole('PCP').map((item) => item.path)).toContain('/workflow');
  });
  it('only manages PCP steps', () => {
    expect(canManagePcpStage('PCP')).toBe(true);
    expect(canManagePcpStage('SUPER_ADMIN')).toBe(true);
    expect(canManagePcpStage('COMERCIAL')).toBe(false);
    expect(canManageToolingStage('PCP')).toBe(false);
    expect(canManageSampleStage('PCP')).toBe(false);
    expect(canManageSolicitations('PCP')).toBe(false);
    expect(canRoleAccessPath('PCP', '/usuarios')).toBe(false);
    expect(canRoleAccessPath('PCP', '/configuracoes')).toBe(false);
  });
});

describe('Process Engineering lead', () => {
  it('is only the Desenvolvimento de Processos admin', () => {
    expect(isProcessEngineeringLead('ADMIN', 'DESENVOLVIMENTO_PROCESSOS')).toBe(
      true,
    );
    expect(isProcessEngineeringLead('USER', 'DESENVOLVIMENTO_PROCESSOS')).toBe(
      false,
    );
    expect(isProcessEngineeringLead('ADMIN', 'AMOSTRA')).toBe(false);
  });

  it('does not manage the sample stage', () => {
    expect(canManageSampleStage('ADMIN', 'DESENVOLVIMENTO_PROCESSOS')).toBe(
      false,
    );
    expect(canManageSampleStage('ADMIN', 'AMOSTRA')).toBe(true);
  });
});

describe('canManageToolingStage', () => {
  it('allows Ferramentaria admins', () => {
    expect(canManageToolingStage('ADMIN', 'FERRAMENTARIA')).toBe(true);
  });

  it('does not allow Process Engineering admins', () => {
    expect(
      canManageToolingStage('ADMIN', 'DESENVOLVIMENTO_PROCESSOS'),
    ).toBe(false);
  });

  it('shows process charts only to the process development admin', () => {
    expect(canAccessProcessCharts('ADMIN', 'DESENVOLVIMENTO_PROCESSOS')).toBe(
      true,
    );
    expect(canAccessProcessCharts('ADMIN', 'ENG_MECANICA')).toBe(false);
    expect(canAccessProcessCharts('SUPER_ADMIN', null)).toBe(false);
    expect(canAccessProcessCharts('USER', 'DESENVOLVIMENTO_PROCESSOS')).toBe(
      false,
    );
  });

  it('preserves super-admin access', () => {
    expect(canManageToolingStage('SUPER_ADMIN', null)).toBe(true);
  });
});

describe('assignableDepartments', () => {
  it('returns no departments when creating a super admin', () => {
    expect(assignableDepartments('SUPER_ADMIN', null, 'SUPER_ADMIN')).toEqual(
      [],
    );
  });
});

describe('canAccessOfTracking', () => {
  it('allows every admin department and super admin', () => {
    expect(canAccessOfTracking('ADMIN', 'ENG_MECANICA')).toBe(true);
    expect(canAccessOfTracking('ADMIN', 'DESENVOLVIMENTO_PROCESSOS')).toBe(
      true,
    );
    expect(canAccessOfTracking('ADMIN', 'FERRAMENTARIA')).toBe(true);
    expect(canAccessOfTracking('ADMIN', 'AMOSTRA')).toBe(true);
    expect(canAccessOfTracking('SUPER_ADMIN')).toBe(true);
  });

  it('blocks user and comercial', () => {
    expect(canAccessOfTracking('USER', 'ENG_MECANICA')).toBe(false);
    expect(canAccessOfTracking('COMERCIAL', 'DESENVOLVIMENTO_PROCESSOS')).toBe(
      false,
    );
  });
});


describe('Quality accounts', () => {
  it('provides workflow navigation and PPAP controls only for Quality admins', () => {
    expect(canManageQualityStage('ADMIN', 'QUALIDADE')).toBe(true);
    expect(canManageQualityStage('SUPER_ADMIN')).toBe(true);
    expect(canManageQualityStage('USER', 'QUALIDADE')).toBe(false);
    expect(canManageSampleStage('ADMIN', 'QUALIDADE')).toBe(false);
    expect(canManageQualityStage('ADMIN', 'AMOSTRA')).toBe(false);
    expect(getHomePathForRole('ADMIN', 'QUALIDADE')).toBe('/workflow');
    expect(canRoleAccessPath('ADMIN', '/workflow', 'QUALIDADE')).toBe(true);
    expect(canRoleAccessPath('ADMIN', '/usuarios', 'QUALIDADE')).toBe(false);
    expect(assignableDepartments('ADMIN', 'DESENVOLVIMENTO_PROCESSOS', 'ADMIN')).toContain('QUALIDADE');
  });
});

describe('stage decline ownership', () => {
  const kinds = ['ENGENHARIA', 'PCP_FERRAMENTARIA', 'FERRAMENTARIA', 'PCP_AMOSTRA', 'QUALIDADE', 'AMOSTRA'] as const;
  const owners = [
    { role: 'ADMIN', department: 'DESENVOLVIMENTO_PROCESSOS', stages: ['ENGENHARIA'] },
    { role: 'PCP', department: 'DESENVOLVIMENTO_PROCESSOS', stages: ['PCP_FERRAMENTARIA', 'PCP_AMOSTRA'] },
    { role: 'ADMIN', department: 'FERRAMENTARIA', stages: ['FERRAMENTARIA'] },
    { role: 'ADMIN', department: 'QUALIDADE', stages: ['QUALIDADE'] },
    { role: 'ADMIN', department: 'AMOSTRA', stages: ['AMOSTRA'] },
    { role: 'ADMIN', department: 'ENG_MECANICA', stages: [] },
    { role: 'SUPER_ADMIN', department: null, stages: [] },
    { role: 'SUPER_ADMIN', department: 'QUALIDADE', stages: [] },
    { role: 'USER', department: 'QUALIDADE', stages: [] },
    { role: 'COMERCIAL', department: 'DESENVOLVIMENTO_PROCESSOS', stages: [] },
  ] as const;
  for (const owner of owners) it(`restricts ${owner.role}/${owner.department} to owned stages`, () => {
    for (const stage of kinds) expect(canDeclineWorkflowStage(owner.role, owner.department, stage)).toBe((owner.stages as readonly string[]).includes(stage));
  });
});
