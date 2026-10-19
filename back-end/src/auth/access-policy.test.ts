import { describe, expect, it } from 'vitest';
import { $Enums } from '../generated/prisma/client.js';
import {
  canAccessProcessCharts,
  canManageSampleStage,
  canManageToolingStage,
  visibleWorkflowStages,
} from './access-policy.js';

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

  it('shows process charts only to the process development admin', () => {
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
        department: $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS,
      }),
    ).toBe(false);
  });

  it('preserves super-admin access', () => {
    expect(
      canManageToolingStage({
        role: $Enums.UserRole.SUPER_ADMIN,
        department: $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS,
      }),
    ).toBe(true);
  });
});
