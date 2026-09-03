export const UNIT = ['PEDERTRACTOR', 'TRACTOR'] as const;
export type Unit = (typeof UNIT)[number];

export type UserRole = 'USER' | 'ADMIN';

export interface AuthUser {
  id: string;
  cardNumber: string | null;
  unit: Unit;
  name: string | null;
  role: UserRole;
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
