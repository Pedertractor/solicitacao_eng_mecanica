import type { UserRole } from '@/types/auth';

export const formattedRoles: Record<UserRole, string> = {
  USER: 'usuário',
  ADMIN: 'admin',
  RESPONSIBLE: 'responsável',
  LEADER: 'líder',
};
