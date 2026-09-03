import type { UserRole } from '@/types/auth';

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

export function canAccessSolicitations(role: UserRole): boolean {
  return role === 'ADMIN';
}
