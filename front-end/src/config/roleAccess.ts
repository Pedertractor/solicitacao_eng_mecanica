import { ROUTES } from '@/routes/constants';
import {
  SIDEBAR_NAV_ITEMS,
  type SidebarNavItem,
} from '@/config/sidebar';
import type { UserDepartment, UserRole } from '@/types/auth';
import {
  canAccessOfTracking,
  canAccessProcessCharts,
  canAccessSettings,
  canAccessSolicitations,
  canAccessUsersArea,
  canAccessWorkflow,
  isWorkflowOnlyRole,
} from '@/config/permissions';

const SOLICITATION_NAV: readonly string[] = [ROUTES.SOLICITACOES] as const;

const WORKFLOW_NAV: readonly string[] = [
  ROUTES.WORKFLOW,
  ROUTES.SOLICITACOES,
] as const;

const ADMIN_PROCESSOS_NAV: readonly string[] = [
  ROUTES.SOLICITACOES,
  ROUTES.INDICADORES,
  ROUTES.WORKFLOW,
  ROUTES.RASTREIO,
  ROUTES.USUARIOS,
] as const;

const ADMIN_ENG_NAV: readonly string[] = [
  ROUTES.SOLICITACOES,
  ROUTES.RASTREIO,
  ROUTES.USUARIOS,
] as const;

const ADMIN_WORKFLOW_NAV: readonly string[] = [
  ROUTES.WORKFLOW,
  ROUTES.SOLICITACOES,
  ROUTES.RASTREIO,
] as const;

const SUPER_ADMIN_NAV: readonly string[] = [
  ROUTES.SOLICITACOES,
  ROUTES.WORKFLOW,
  ROUTES.RASTREIO,
  ROUTES.USUARIOS,
] as const;

const PROTECTED_PATH_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/solicitacoes(\/.*)?$/,
  /^\/indicadores(\/.*)?$/,
  /^\/workflow(\/.*)?$/,
  /^\/rastreio(\/.*)?$/,
  /^\/usuarios(\/.*)?$/,
  /^\/configuracoes(\/.*)?$/,
  /^\/perfil(\/.*)?$/,
];

export function getNavPaths(
  role: UserRole,
  department?: UserDepartment,
): readonly string[] {
  if (role === 'SUPER_ADMIN') return SUPER_ADMIN_NAV;
  if (role === 'COMERCIAL') return WORKFLOW_NAV;
  if (role === 'USER') return SOLICITATION_NAV;
  if (role === 'ADMIN') {
    if (department === 'ENG_MECANICA') return ADMIN_ENG_NAV;
    if (department === 'DESENVOLVIMENTO_PROCESSOS') return ADMIN_PROCESSOS_NAV;
    if (department === 'FERRAMENTARIA' || department === 'AMOSTRA') {
      return ADMIN_WORKFLOW_NAV;
    }
  }
  return SOLICITATION_NAV;
}

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

export function canRoleAccessPath(
  role: UserRole,
  pathname: string,
  department?: UserDepartment,
): boolean {
  const normalized = pathname || '/';
  if (!isAppShellPath(normalized)) return true;

  if (normalized === '/' || normalized === '') {
    return (
      canAccessSolicitations(role, department) ||
      canAccessWorkflow(role, department)
    );
  }

  if (
    normalized === ROUTES.SOLICITACOES ||
    normalized.startsWith(`${ROUTES.SOLICITACOES}/`)
  ) {
    return canAccessSolicitations(role, department);
  }

  if (
    normalized === ROUTES.INDICADORES ||
    normalized.startsWith(`${ROUTES.INDICADORES}/`)
  ) {
    return canAccessProcessCharts(role, department);
  }

  if (
    normalized === ROUTES.WORKFLOW ||
    normalized.startsWith(`${ROUTES.WORKFLOW}/`)
  ) {
    return canAccessWorkflow(role, department);
  }

  if (
    normalized === ROUTES.RASTREIO ||
    normalized.startsWith(`${ROUTES.RASTREIO}/`)
  ) {
    return canAccessOfTracking(role, department);
  }

  if (
    normalized === ROUTES.USUARIOS ||
    normalized.startsWith(`${ROUTES.USUARIOS}/`)
  ) {
    return canAccessUsersArea(role, department);
  }

  if (
    normalized === ROUTES.CONFIGURACOES ||
    normalized.startsWith(`${ROUTES.CONFIGURACOES}/`)
  ) {
    return canAccessSettings(role);
  }

  if (
    normalized === ROUTES.PERFIL ||
    normalized.startsWith(`${ROUTES.PERFIL}/`)
  ) {
    return true;
  }

  const allowed = getNavPaths(role, department);
  return allowed.some((segment) => pathMatchesNavSegment(normalized, segment));
}

export function getSidebarNavItemsForRole(
  role: UserRole,
  department?: UserDepartment,
): SidebarNavItem[] {
  const allowed = new Set(getNavPaths(role, department));
  return SIDEBAR_NAV_ITEMS.filter((item) => {
    if (!allowed.has(item.path)) return false;
    if (item.path === ROUTES.USUARIOS && !canAccessUsersArea(role, department)) {
      return false;
    }
    if (
      item.path === ROUTES.SOLICITACOES &&
      !canAccessSolicitations(role, department)
    ) {
      return false;
    }
    if (item.path === ROUTES.WORKFLOW && !canAccessWorkflow(role, department)) {
      return false;
    }
    if (
      item.path === ROUTES.INDICADORES &&
      !canAccessProcessCharts(role, department)
    ) {
      return false;
    }
    if (
      item.path === ROUTES.RASTREIO &&
      !canAccessOfTracking(role, department)
    ) {
      return false;
    }
    return true;
  });
}

export function getHomePathForRole(
  role: UserRole,
  department?: UserDepartment,
): string {
  if (isWorkflowOnlyRole(role, department)) return ROUTES.WORKFLOW;
  return ROUTES.SOLICITACOES;
}
