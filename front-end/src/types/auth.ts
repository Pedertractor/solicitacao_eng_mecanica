export const UNIT = ['PEDERTRACTOR', 'TRACTOR'] as const;
export type Unit = (typeof UNIT)[number];

export const USER_ROLES = [
  'SUPER_ADMIN',
  'ADMIN_ENG',
  'ADMIN_PROCESSOS',
  'USER',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_DEPARTMENTS = [
  'ENG_MECANICA',
  'DESENVOLVIMENTO_PROCESSOS',
] as const;
export type UserDepartment = (typeof USER_DEPARTMENTS)[number];

export const USER_APPROVAL_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
] as const;
export type UserApprovalStatus = (typeof USER_APPROVAL_STATUSES)[number];

export interface AuthUser {
  id: string;
  cardNumber: string | null;
  unit: Unit;
  name: string | null;
  role: UserRole;
  department: UserDepartment;
  approvalStatus: UserApprovalStatus;
  /** Indica que o usuário deve trocar a senha (ex.: primeiro login) */
  mustChangePassword?: boolean;
  active?: boolean;
  createdAt?: string;
}

export interface ListUser {
  id: string;
  name: string;
  cardNumber: string;
  unit: Unit;
  role: UserRole;
  department: UserDepartment;
  approvalStatus: UserApprovalStatus;
  active: boolean;
  createdAt: string;
}

export interface LoginCredentials {
  cardNumber: string;
  unit: Unit;
  password: string;
}

export interface LoginResponse {
  user: AuthUser;
  token: string;
}
