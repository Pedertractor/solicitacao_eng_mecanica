import { $Enums } from '../generated/prisma/client.js';

export const BOOTSTRAP_SUPER_ADMIN_CARD = '5487';
export const BOOTSTRAP_SUPER_ADMIN_UNIT = $Enums.Unit.PEDERTRACTOR;

export function isBootstrapSuperAdmin(user: {
  cardNumber: string;
  unit: $Enums.Unit;
}): boolean {
  return (
    user.cardNumber === BOOTSTRAP_SUPER_ADMIN_CARD &&
    user.unit === BOOTSTRAP_SUPER_ADMIN_UNIT
  );
}

export const BOOTSTRAP_SUPER_ADMIN_ROLE = $Enums.UserRole.SUPER_ADMIN;
/** Super admins have no department. */
export const BOOTSTRAP_SUPER_ADMIN_DEPARTMENT = null;
