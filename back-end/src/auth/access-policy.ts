import { $Enums, type Prisma } from '../generated/prisma/client.js';

export type AccessActor = {
  id: string;
  role: $Enums.UserRole;
  department: $Enums.UserDepartment;
  cardNumber: string;
  unit: $Enums.Unit;
};

export const AREA_ADMIN_ROLES: $Enums.UserRole[] = [
  $Enums.UserRole.SUPER_ADMIN,
  $Enums.UserRole.ADMIN_ENG,
  $Enums.UserRole.ADMIN_PROCESSOS,
];

export function isSuperAdmin(role: $Enums.UserRole): boolean {
  return role === $Enums.UserRole.SUPER_ADMIN;
}

export function managedDepartment(
  role: $Enums.UserRole,
): $Enums.UserDepartment | null {
  if (role === $Enums.UserRole.ADMIN_ENG) {
    return $Enums.UserDepartment.ENG_MECANICA;
  }
  if (role === $Enums.UserRole.ADMIN_PROCESSOS) {
    return $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS;
  }
  return null;
}

export function isPlatformAdmin(role: $Enums.UserRole): boolean {
  return isSuperAdmin(role) || managedDepartment(role) != null;
}

export function canManageSolicitations(role: $Enums.UserRole): boolean {
  return isPlatformAdmin(role);
}

export function canManageUser(
  actor: Pick<AccessActor, 'role' | 'department'>,
  target: { role: $Enums.UserRole; department: $Enums.UserDepartment },
): boolean {
  if (isSuperAdmin(actor.role)) return true;

  const department = managedDepartment(actor.role);
  if (!department || target.department !== department) return false;
  if (target.role === $Enums.UserRole.SUPER_ADMIN) return false;

  const targetAdminDepartment = managedDepartment(target.role);
  if (targetAdminDepartment && targetAdminDepartment !== department) {
    return false;
  }

  return true;
}

export function canAssignRole(
  actor: Pick<AccessActor, 'role'>,
  nextRole: $Enums.UserRole,
): boolean {
  if (isSuperAdmin(actor.role)) return true;
  if (nextRole === $Enums.UserRole.USER) return isPlatformAdmin(actor.role);
  return nextRole === actor.role;
}

export function departmentForAssignedRole(
  role: $Enums.UserRole,
  current: $Enums.UserDepartment,
): $Enums.UserDepartment {
  if (role === $Enums.UserRole.ADMIN_ENG) {
    return $Enums.UserDepartment.ENG_MECANICA;
  }
  if (role === $Enums.UserRole.ADMIN_PROCESSOS) {
    return $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS;
  }
  return current;
}

export function solicitationScope(
  actor: Pick<AccessActor, 'role' | 'department' | 'cardNumber' | 'unit'>,
): Prisma.SolicitationWhereInput {
  if (isSuperAdmin(actor.role)) return {};
  if (isPlatformAdmin(actor.role)) {
    return { department: actor.department };
  }
  return {
    department: actor.department,
    cardNumber: actor.cardNumber,
    unit: actor.unit,
  };
}

export function canAccessSolicitation(
  actor: Pick<AccessActor, 'role' | 'department' | 'cardNumber' | 'unit'>,
  solicitation: {
    department: $Enums.UserDepartment;
    cardNumber: string;
    unit: $Enums.Unit;
  },
): boolean {
  if (isSuperAdmin(actor.role)) return true;
  if (solicitation.department !== actor.department) return false;
  if (isPlatformAdmin(actor.role)) return true;
  return (
    solicitation.cardNumber === actor.cardNumber &&
    solicitation.unit === actor.unit
  );
}

export function actorFromSession(user: {
  sub: string;
  role: $Enums.UserRole;
  department: $Enums.UserDepartment;
  cardNumber: string;
  unit: $Enums.Unit;
}): AccessActor {
  return {
    id: user.sub,
    role: user.role,
    department: user.department,
    cardNumber: user.cardNumber,
    unit: user.unit,
  };
}
