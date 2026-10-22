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
    return ['USER', 'ADMIN', 'SUPER_ADMIN', 'COMERCIAL'];
  }
  if (actorRole === 'ADMIN' && actorDepartment === 'ENG_MECANICA') {
    return ['USER', 'ADMIN'];
  }
  if (
    actorRole === 'ADMIN' &&
    actorDepartment === 'DESENVOLVIMENTO_PROCESSOS'
  ) {
    return ['USER', 'ADMIN', 'COMERCIAL'];
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
    if (targetRole === 'COMERCIAL') return ['DESENVOLVIMENTO_PROCESSOS'];
    return [
      'ENG_MECANICA',
      'DESENVOLVIMENTO_PROCESSOS',
      'FERRAMENTARIA',
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
    if (targetRole === 'COMERCIAL') return ['DESENVOLVIMENTO_PROCESSOS'];
    return ['DESENVOLVIMENTO_PROCESSOS', 'FERRAMENTARIA', 'AMOSTRA'];
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
    role === 'COMERCIAL'
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
  if (isSuperAdmin(role) || role === 'COMERCIAL') return true;
  if (role !== 'ADMIN' || !department) return false;
  return (
    department === 'DESENVOLVIMENTO_PROCESSOS' ||
    department === 'FERRAMENTARIA' ||
    department === 'AMOSTRA'
  );
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
  if (role === 'COMERCIAL') return true;
  if (role === 'ADMIN' && department) {
    return department === 'FERRAMENTARIA' || department === 'AMOSTRA';
  }
  return false;
}
