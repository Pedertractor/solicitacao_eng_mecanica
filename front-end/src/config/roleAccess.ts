import { ROUTES } from '@/routes/constants';
import {
  SIDEBAR_NAV_ITEMS,
  type SidebarNavItem,
} from '@/config/sidebar';
import type { UserRole } from '@/types/auth';
import {
  canAccessSolicitations,
  canAccessUsersArea,
} from '@/config/permissions';

const FULL_NAV_PATHS: readonly string[] = [
  ROUTES.SOLICITACOES,
  ROUTES.USUARIOS,
] as const;

const USER_NAV_PATHS: readonly string[] = [] as const;

export const NAV_PATHS_BY_ROLE: Record<UserRole, readonly string[]> = {
  USER: USER_NAV_PATHS,
  ADMIN: FULL_NAV_PATHS,
};

const PROTECTED_PATH_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/solicitacoes(\/.*)?$/,
  /^\/usuarios(\/.*)?$/,
];

export function isAppShellPath(pathname: string): boolean {
  const n = pathname || '/';
  return PROTECTED_PATH_PATTERNS.some((re) => re.test(n));
}

export function pathMatchesNavSegment(pathname: string, navPath: string): boolean {
  const normalized = pathname || '/';
  if (normalized === navPath) return true;
  if (normalized.startsWith(`${navPath}/`)) return true;
  return false;
}

export function pathMatchesNavExact(pathname: string, navPath: string): boolean {
  return pathMatchesNavSegment(pathname, navPath);
}

export function canRoleAccessPath(role: UserRole, pathname: string): boolean {
  const normalized = pathname || '/';
  if (!isAppShellPath(normalized)) return true;

  if (normalized === '/' || normalized === '') {
    return role === 'ADMIN';
  }

  if (
    normalized === ROUTES.SOLICITACOES ||
    normalized.startsWith(`${ROUTES.SOLICITACOES}/`)
  ) {
    return canAccessSolicitations(role);
  }

  if (
    normalized === ROUTES.USUARIOS ||
    normalized.startsWith(`${ROUTES.USUARIOS}/`)
  ) {
    return canAccessUsersArea(role);
  }

  const allowed = NAV_PATHS_BY_ROLE[role];
  return allowed.some((segment) => pathMatchesNavSegment(normalized, segment));
}

export function getSidebarNavItemsForRole(role: UserRole): SidebarNavItem[] {
  const allowed = new Set(NAV_PATHS_BY_ROLE[role]);
  return SIDEBAR_NAV_ITEMS.filter((item) => {
    if (!allowed.has(item.path)) return false;
    if (item.path === ROUTES.USUARIOS && !canAccessUsersArea(role)) return false;
    if (
      item.path === ROUTES.SOLICITACOES &&
      !canAccessSolicitations(role)
    ) {
      return false;
    }
    return true;
  });
}
