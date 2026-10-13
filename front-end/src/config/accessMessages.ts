import type { AuthUser } from '@/types/auth';
import { roleLabel } from '@/utils/roles';

export type AccessDeniedCopy = {
  title: string;
  description: string;
};

export function getHomeNoAccessCopy(user: AuthUser): AccessDeniedCopy {
  const label = roleLabel(user.role, user.department);
  return {
    title: 'Acesso limitado',
    description: `Bem-vindo${user.name ? `, ${user.name}` : ''}. Com o perfil de ${label}, você não tem acesso ao painel administrativo.`,
  };
}

export function getRedirectAccessDeniedCopy(): AccessDeniedCopy {
  return {
    title: 'Sem permissão',
    description:
      'Você não tem permissão para acessar esta página com o seu perfil atual.',
  };
}
