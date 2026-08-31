import type { PillarCode } from '@/config/pillars';
import type { UserRole } from '@/types/auth';

export interface P5UserContext {
  role: UserRole;
  assignedPillarCodes?: PillarCode[];
}

/** Área de usuários na sidebar. */
export function canAccessUsersArea(role: UserRole): boolean {
  return role === 'ADMIN';
}

export function canCreateUser(role: UserRole): boolean {
  return role === 'ADMIN';
}

/** Apenas ADMIN pode definir papel Admin ao registrar um novo usuário. */
export function canAssignAdminRoleOnRegister(actorRole: UserRole): boolean {
  return actorRole === 'ADMIN';
}

/** Alterar papel na lista (API: PATCH /users/:id — ADMIN). */
export function canEditUserAsAdmin(role: UserRole): boolean {
  return role === 'ADMIN';
}

/** Redefinir senha temporária de outro usuário. */
export function canResetUserPassword(role: UserRole): boolean {
  return role === 'ADMIN';
}

/** Módulo Programa P5 (ADMIN ou RESPONSIBLE com pilares). */
export function canAccessP5Area(user: P5UserContext): boolean {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'RESPONSIBLE') {
    return (user.assignedPillarCodes?.length ?? 0) > 0;
  }
  return false;
}

export function canViewPillar(user: P5UserContext, pillarCode: PillarCode): boolean {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'RESPONSIBLE') {
    return user.assignedPillarCodes?.includes(pillarCode) ?? false;
  }
  return false;
}

export function canEditPillar(user: P5UserContext, pillarCode: PillarCode): boolean {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'RESPONSIBLE') {
    if (pillarCode === 'SAFETY') return false;
    return user.assignedPillarCodes?.includes(pillarCode) ?? false;
  }
  return false;
}

export function canManageCycles(role: UserRole): boolean {
  return role === 'ADMIN';
}

export function canManageP5Configuration(role: UserRole): boolean {
  return role === 'ADMIN';
}

export function canManageP5(user: P5UserContext): boolean {
  return user.role === 'ADMIN';
}

export function canSimulateAccidents(role: UserRole): boolean {
  return role === 'ADMIN';
}
