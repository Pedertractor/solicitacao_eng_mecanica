import type { UserApprovalStatus, UserDepartment, UserRole } from '@/types/auth';

export const formattedRoles: Record<UserRole, string> = {
  USER: 'Usuário',
  ADMIN_ENG: 'Adm. Engenharia',
  ADMIN_PROCESSOS: 'Adm. Processos',
  SUPER_ADMIN: 'Super admin',
};

export const DEPARTMENT_LABELS: Record<UserDepartment, string> = {
  ENG_MECANICA: 'Engenharia Mecânica',
  DESENVOLVIMENTO_PROCESSOS: 'Desenvolvimento de Processos',
};

export const APPROVAL_STATUS_LABELS: Record<UserApprovalStatus, string> = {
  PENDING: 'Aguardando aprovação',
  APPROVED: 'Aprovado',
  REJECTED: 'Recusado',
};

export function roleLabel(role: string): string {
  return formattedRoles[role as UserRole] ?? role;
}
