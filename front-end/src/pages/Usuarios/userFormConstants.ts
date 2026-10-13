import type { UserRole } from '@/types/auth';
import { ROLE_BASE_LABELS } from '@/utils/roles';

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = (
  Object.entries(ROLE_BASE_LABELS) as [UserRole, string][]
).map(([value, label]) => ({ value, label }));
