import type { UserRole } from '@/types/auth';

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'USER', label: 'Usuário' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'RESPONSIBLE', label: 'Responsável' },
  { value: 'LEADER', label: 'Líder' },
];
