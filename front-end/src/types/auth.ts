import type { PillarCode } from '@/config/pillars';

export const UNIT = ['PEDERTRACTOR', 'TRACTOR'] as const;
export type Unit = (typeof UNIT)[number];

export type UserRole = 'USER' | 'ADMIN' | 'RESPONSIBLE' | 'LEADER';

export interface AuthUser {
  id: string;
  cardNumber: string | null;
  unit: Unit;
  name: string | null;
  role: UserRole;
  assignedPillarCodes?: PillarCode[];
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
  assignedPillarCodes?: PillarCode[];
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

