import { describe, expect, it } from 'vitest';
import {
  canAccessOfTracking,
  canAccessProcessCharts,
  canManageSampleStage,
  canManageToolingStage,
  isProcessEngineeringLead,
} from './permissions';

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
    expect(
      canAccessProcessCharts('SUPER_ADMIN', 'DESENVOLVIMENTO_PROCESSOS'),
    ).toBe(false);
    expect(canAccessProcessCharts('USER', 'DESENVOLVIMENTO_PROCESSOS')).toBe(
      false,
    );
  });

  it('preserves super-admin access', () => {
    expect(
      canManageToolingStage('SUPER_ADMIN', 'DESENVOLVIMENTO_PROCESSOS'),
    ).toBe(true);
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
