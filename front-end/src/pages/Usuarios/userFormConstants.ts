import type { UserRole } from '@/types/auth';
import { formattedRoles } from '@/utils/roles';

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = (
  Object.entries(formattedRoles) as [UserRole, string][]
).map(([value, label]) => ({ value, label }));
