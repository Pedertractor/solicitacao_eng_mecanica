import type { UserRole } from '@/types/auth';

function isPlatformAdmin(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN_ENG' || role === 'ADMIN_PROCESSOS';
}

export function canAccessUsersArea(role: UserRole): boolean {
  return isPlatformAdmin(role);
}

export function canCreateUser(role: UserRole): boolean {
  return isPlatformAdmin(role);
}

export function assignableRoles(actorRole: UserRole): UserRole[] {
  if (actorRole === 'SUPER_ADMIN') {
    return ['USER', 'ADMIN_ENG', 'ADMIN_PROCESSOS', 'SUPER_ADMIN'];
  }
  if (actorRole === 'ADMIN_ENG') return ['USER', 'ADMIN_ENG'];
  if (actorRole === 'ADMIN_PROCESSOS') return ['USER', 'ADMIN_PROCESSOS'];
  return [];
}

export function canEditUserAsAdmin(role: UserRole): boolean {
  return isPlatformAdmin(role);
}

export function canResetUserPassword(role: UserRole): boolean {
  return isPlatformAdmin(role);
}

export function canApproveUsers(role: UserRole): boolean {
  return isPlatformAdmin(role);
}

export function canAccessSolicitations(role: UserRole): boolean {
  return (
    role === 'USER' ||
    role === 'ADMIN_ENG' ||
    role === 'ADMIN_PROCESSOS' ||
    role === 'SUPER_ADMIN'
  );
}

export function canManageSolicitations(role: UserRole): boolean {
  return isPlatformAdmin(role);
}

export function canAccessSettings(role: UserRole): boolean {
  return role === 'SUPER_ADMIN';
}
