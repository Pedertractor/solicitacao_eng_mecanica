import type { UserApprovalStatus, UserDepartment, UserRole } from '@/types/auth';

export const ROLE_BASE_LABELS: Record<UserRole, string> = {
  USER: 'Usuário',
  ADMIN: 'Administrador',
  SUPER_ADMIN: 'Super admin',
  COMERCIAL: 'Comercial',
};

/** @deprecated Prefer roleLabel(role, department) */
export const formattedRoles: Record<UserRole, string> = ROLE_BASE_LABELS;

export const DEPARTMENT_LABELS: Record<UserDepartment, string> = {
  ENG_MECANICA: 'Engenharia Mecânica',
  DESENVOLVIMENTO_PROCESSOS: 'Desenvolvimento de Processos',
  FERRAMENTARIA: 'Ferramentaria',
  AMOSTRA: 'Amostra',
};

export const APPROVAL_STATUS_LABELS: Record<UserApprovalStatus, string> = {
  PENDING: 'Aguardando aprovação',
  APPROVED: 'Aprovado',
  REJECTED: 'Recusado',
};

const ADMIN_DEPARTMENT_LABELS: Partial<Record<UserDepartment, string>> = {
  ENG_MECANICA: 'Adm. Engenharia',
  DESENVOLVIMENTO_PROCESSOS: 'Adm. Processos',
  FERRAMENTARIA: 'Adm. Ferramentaria',
  AMOSTRA: 'Adm. Amostra',
};

export function roleLabel(
  role: string,
  department?: UserDepartment | null,
): string {
  if (role === 'ADMIN' && department) {
    return ADMIN_DEPARTMENT_LABELS[department] ?? 'Administrador';
  }
  return ROLE_BASE_LABELS[role as UserRole] ?? role;
}
