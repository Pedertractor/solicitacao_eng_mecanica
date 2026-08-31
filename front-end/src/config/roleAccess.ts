import type { PillarCode } from '@/config/pillars';
import { ROUTES } from '@/routes/constants';
import {
  HOME_NAV_CHILDREN,
  SIDEBAR_NAV_ITEMS,
  type SidebarNavItem,
} from '@/config/sidebar';
import type { UserRole } from '@/types/auth';
import {
  canAccessP5Area,
  canAccessUsersArea,
  canManageP5Configuration,
  canViewPillar,
  type P5UserContext,
} from '@/config/permissions';

const FULL_NAV_PATHS: readonly string[] = [
  ROUTES.HOME,
  ROUTES.SIMULACAO,
  ROUTES.USUARIOS,
] as const;

const USER_NAV_PATHS: readonly string[] = [ROUTES.HOME] as const;

export const NAV_PATHS_BY_ROLE: Record<UserRole, readonly string[]> = {
  USER: USER_NAV_PATHS,
  ADMIN: FULL_NAV_PATHS,
  RESPONSIBLE: USER_NAV_PATHS,
  LEADER: USER_NAV_PATHS,
};

/** Paths that belong to the app shell; unknown paths fall through to 404 without role redirect */
const PROTECTED_PATH_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/usuarios(\/.*)?$/,
  /^\/simulacao(\/.*)?$/,
  /^\/p5(\/.*)?$/,
];

function toP5Context(
  role: UserRole,
  assignedPillarCodes?: PillarCode[],
): P5UserContext {
  return { role, assignedPillarCodes };
}

export function isAppShellPath(pathname: string): boolean {
  const n = pathname || '/';
  return PROTECTED_PATH_PATTERNS.some((re) => re.test(n));
}

export function pathMatchesNavSegment(pathname: string, navPath: string): boolean {
  const normalized = pathname || '/';
  if (navPath === ROUTES.HOME) {
    return (
      normalized === '/' ||
      normalized === '' ||
      normalized === ROUTES.P5 ||
      normalized.startsWith(`${ROUTES.P5}/`)
    );
  }
  if (normalized === navPath) return true;
  if (normalized.startsWith(`${navPath}/`)) return true;
  return false;
}

/** Match exato de item (evita marcar “Visão geral” em /p5/ciclos). */
export function pathMatchesNavExact(pathname: string, navPath: string): boolean {
  const normalized = pathname || '/';
  if (navPath === ROUTES.HOME) {
    return normalized === '/' || normalized === '';
  }
  if (normalized === navPath) return true;
  if (normalized.startsWith(`${navPath}/`)) return true;
  return false;
}

export function canRoleAccessPath(
  role: UserRole,
  pathname: string,
  assignedPillarCodes?: PillarCode[],
): boolean {
  const normalized = pathname || '/';
  if (!isAppShellPath(normalized)) return true;

  const p5Context = toP5Context(role, assignedPillarCodes);

  if (normalized === ROUTES.P5 || normalized.startsWith(`${ROUTES.P5}/`)) {
    if (normalized.startsWith(`${ROUTES.P5_CONFIGURACOES}`)) {
      return canManageP5Configuration(role);
    }
    if (normalized.startsWith(`${ROUTES.P5_PAINEL_PONTUACAO}`)) {
      return canManageP5Configuration(role);
    }
    const safetyMatch = /^\/p5\/ciclos\/[^/]+\/seguranca\/?$/.test(normalized);
    if (safetyMatch) {
      return (
        canAccessP5Area(p5Context) &&
        canViewPillar(p5Context, 'SAFETY')
      );
    }
    return canAccessP5Area(p5Context);
  }

  if (
    normalized === ROUTES.SIMULACAO ||
    normalized.startsWith(`${ROUTES.SIMULACAO}/`)
  ) {
    return role === 'ADMIN';
  }

  const allowed = NAV_PATHS_BY_ROLE[role];

  const segmentOk = allowed.some((segment) =>
    pathMatchesNavSegment(normalized, segment),
  );
  if (!segmentOk) return false;

  if (normalized === ROUTES.USUARIOS || normalized.startsWith(`${ROUTES.USUARIOS}/`)) {
    if (!canAccessUsersArea(role)) return false;
  }

  return true;
}

export function getSidebarNavItemsForRole(
  role: UserRole,
  assignedPillarCodes?: PillarCode[],
): SidebarNavItem[] {
  const p5Context = toP5Context(role, assignedPillarCodes);
  const allowed = new Set(NAV_PATHS_BY_ROLE[role]);
  return SIDEBAR_NAV_ITEMS.filter((item) => {
    if (!allowed.has(item.path)) return false;
    if (item.path === ROUTES.USUARIOS && !canAccessUsersArea(role)) return false;
    if (item.path === ROUTES.SIMULACAO && role !== 'ADMIN') return false;
    return true;
  }).map((item) => {
    if (item.path === ROUTES.HOME && canAccessP5Area(p5Context)) {
      const children = HOME_NAV_CHILDREN.filter((child) => {
        if (
          child.path === ROUTES.P5_CONFIGURACOES ||
          child.path === ROUTES.P5_PAINEL_PONTUACAO
        ) {
          return canManageP5Configuration(role);
        }
        return true;
      });
      return { ...item, children };
    }
    return item;
  });
}
