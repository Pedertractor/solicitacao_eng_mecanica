import type { UserDepartment, UserRole } from '@/types/auth';

type Actor = {
  role: UserRole;
  department: UserDepartment | null;
};

function isSuperAdmin(role: UserRole): boolean {
  return role === 'SUPER_ADMIN';
}

function isAdminOf(actor: Actor, department: UserDepartment): boolean {
  return actor.role === 'ADMIN' && actor.department === department;
}

function isSolicitationAreaAdmin(actor: Actor): boolean {
  return (
    isAdminOf(actor, 'ENG_MECANICA') ||
    isAdminOf(actor, 'DESENVOLVIMENTO_PROCESSOS')
  );
}

export function canAccessUsersArea(
  role: UserRole,
  department?: UserDepartment | null,
): boolean {
  if (isSuperAdmin(role)) return true;
  if (role !== 'ADMIN' || !department) return false;
  return isSolicitationAreaAdmin({ role, department });
}

export function canCreateUser(
  role: UserRole,
  department?: UserDepartment | null,
): boolean {
  return canAccessUsersArea(role, department);
}

export function assignableRoles(
  actorRole: UserRole,
  actorDepartment?: UserDepartment | null,
): UserRole[] {
  if (actorRole === 'SUPER_ADMIN') {
    return ['USER', 'ADMIN', 'SUPER_ADMIN', 'COMERCIAL', 'PCP'];
  }
  if (actorRole === 'ADMIN' && actorDepartment === 'ENG_MECANICA') {
    return ['USER', 'ADMIN'];
  }
  if (
    actorRole === 'ADMIN' &&
    actorDepartment === 'DESENVOLVIMENTO_PROCESSOS'
  ) {
    return ['USER', 'ADMIN', 'COMERCIAL', 'PCP'];
  }
  return [];
}

export function assignableDepartments(
  actorRole: UserRole,
  actorDepartment: UserDepartment | undefined | null,
  targetRole: UserRole,
): UserDepartment[] {
  if (targetRole === 'SUPER_ADMIN') {
    return [];
  }
  if (actorRole === 'SUPER_ADMIN') {
    if (targetRole === 'COMERCIAL' || targetRole === 'PCP') return ['DESENVOLVIMENTO_PROCESSOS'];
    return [
      'ENG_MECANICA',
      'DESENVOLVIMENTO_PROCESSOS',
      'FERRAMENTARIA',
      'QUALIDADE',
      'AMOSTRA',
    ];
  }
  if (actorRole === 'ADMIN' && actorDepartment === 'ENG_MECANICA') {
    return ['ENG_MECANICA'];
  }
  if (
    actorRole === 'ADMIN' &&
    actorDepartment === 'DESENVOLVIMENTO_PROCESSOS'
  ) {
    if (targetRole === 'COMERCIAL' || targetRole === 'PCP') return ['DESENVOLVIMENTO_PROCESSOS'];
    return ['DESENVOLVIMENTO_PROCESSOS', 'FERRAMENTARIA', 'QUALIDADE', 'AMOSTRA'];
  }
  return [];
}

export function canEditUserAsAdmin(
  role: UserRole,
  department?: UserDepartment | null,
): boolean {
  return canAccessUsersArea(role, department);
}

export function canResetUserPassword(
  role: UserRole,
  department?: UserDepartment | null,
): boolean {
  return canAccessUsersArea(role, department);
}

export function canApproveUsers(
  role: UserRole,
  department?: UserDepartment | null,
): boolean {
  return canAccessUsersArea(role, department);
}

export function canAccessSolicitations(
  role: UserRole,
  department?: UserDepartment | null,
): boolean {
  if (
    role === 'USER' ||
    role === 'SUPER_ADMIN' ||
    role === 'COMERCIAL' || role === 'PCP'
  ) {
    return true;
  }
  if (role === 'ADMIN' && department) {
    return true;
  }
  return false;
}

export function canManageSolicitations(
  role: UserRole,
  department?: UserDepartment | null,
): boolean {
  if (isSuperAdmin(role)) return true;
  if (role !== 'ADMIN' || !department) return false;
  return isSolicitationAreaAdmin({ role, department });
}

export function canAccessProcessCharts(
  role: UserRole,
  department?: UserDepartment | null,
): boolean {
  return role === 'ADMIN' && department === 'DESENVOLVIMENTO_PROCESSOS';
}

export function canAccessWorkflow(
  role: UserRole,
  department?: UserDepartment | null,
): boolean {
  if (isSuperAdmin(role) || role === 'COMERCIAL' || role === 'PCP') return true;
  if (role !== 'ADMIN' || !department) return false;
  return (
    department === 'DESENVOLVIMENTO_PROCESSOS' ||
    department === 'FERRAMENTARIA' ||
    department === 'AMOSTRA' ||
    department === 'QUALIDADE'
  );
}

export function canAccessProductionTracking(role: UserRole, department?: UserDepartment | null): boolean {
  return role === 'COMERCIAL' || role === 'SUPER_ADMIN'
    || (role === 'ADMIN' && department === 'DESENVOLVIMENTO_PROCESSOS');
}

export function canManageToolingStage(
  role: UserRole,
  department?: UserDepartment | null,
): boolean {
  if (isSuperAdmin(role)) return true;
  if (role !== 'ADMIN' || !department) return false;
  return department === 'FERRAMENTARIA';
}

export function canManageSampleStage(
  role: UserRole,
  department?: UserDepartment | null,
): boolean {
  if (isSuperAdmin(role)) return true;
  if (role !== 'ADMIN' || !department) return false;
  return department === 'AMOSTRA';
}

export function canManageQualityStage(role: UserRole, department?: UserDepartment | null): boolean {
  return role === 'SUPER_ADMIN' || (role === 'ADMIN' && department === 'QUALIDADE');
}

export function canManagePcpStage(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'PCP';
}

/** Líder de Desenvolvimento de Processos: acompanha só a etapa de Engenharia. */
export function isProcessEngineeringLead(
  role: UserRole,
  department?: UserDepartment | null,
): boolean {
  return role === 'ADMIN' && department === 'DESENVOLVIMENTO_PROCESSOS';
}

export function canAccessSettings(role: UserRole): boolean {
  return role === 'SUPER_ADMIN';
}

export function canAccessOfTracking(
  role: UserRole,
  _department?: UserDepartment | null,
): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

export function isWorkflowOnlyRole(
  role: UserRole,
  department?: UserDepartment | null,
): boolean {
  if (role === 'COMERCIAL' || role === 'PCP') return true;
  if (role === 'ADMIN' && department) {
    return department === 'FERRAMENTARIA' || department === 'AMOSTRA' || department === 'QUALIDADE';
  }
  return false;
}

export function canDeclineWorkflowStage(role: UserRole, department: UserDepartment | null, stage: import('@/services/solicitation').WorkflowStageKind): boolean {
  if (role === 'SUPER_ADMIN') return false;
  switch (stage) {
    case 'ENGENHARIA': return isProcessEngineeringLead(role, department);
    case 'PCP_FERRAMENTARIA': case 'PCP_AMOSTRA': return role === 'PCP';
    case 'FERRAMENTARIA': return canManageToolingStage(role, department);
    case 'QUALIDADE': return canManageQualityStage(role, department);
    case 'AMOSTRA': return canManageSampleStage(role, department);
  }
}
