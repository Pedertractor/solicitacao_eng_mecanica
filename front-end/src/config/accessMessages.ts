import { canAccessP5Area } from '@/config/permissions';
import type { AuthUser } from '@/types/auth';
import { formattedRoles } from '@/utils/roles';

export type AccessDeniedCopy = {
  title: string;
  description: string;
};

/** Mensagem da Home quando o usuário autenticado não entra no dashboard P5. */
export function getHomeNoAccessCopy(user: AuthUser): AccessDeniedCopy {
  if (user.role === 'RESPONSIBLE') {
    const hasPillars = (user.assignedPillarCodes?.length ?? 0) > 0;
    if (!hasPillars) {
      return {
        title: 'Nenhum pilar atribuído',
        description:
          'Sua conta está como responsável, mas ainda não tem pilares vinculados. Peça a um administrador para atribuir ao menos um pilar (por exemplo, Segurança) em Usuários. Sem isso, o Programa P5 permanece inacessível.',
      };
    }
  }

  const roleLabel = formattedRoles[user.role] ?? user.role;
  return {
    title: 'Acesso limitado',
    description: `Bem-vindo${user.name ? `, ${user.name}` : ''}. Com o perfil de ${roleLabel}, você não tem acesso ao módulo P5. Se precisar visualizar indicadores, peça a um administrador para ajustar sua função ou atribuir pilares.`,
  };
}

/** Mensagem ao ser redirecionado por falta de permissão em uma rota. */
export function getRedirectAccessDeniedCopy(
  user: AuthUser,
): AccessDeniedCopy {
  if (
    user.role === 'RESPONSIBLE' &&
    (user.assignedPillarCodes?.length ?? 0) === 0
  ) {
    return getHomeNoAccessCopy(user);
  }

  if (!canAccessP5Area(user)) {
    return getHomeNoAccessCopy(user);
  }

  return {
    title: 'Sem permissão',
    description:
      'Você não tem permissão para acessar esta página com o seu perfil atual.',
  };
}

export const SAFETY_PILLAR_DENIED: AccessDeniedCopy = {
  title: 'Sem acesso ao pilar Segurança',
  description:
    'Esta página exige o pilar Segurança atribuído à sua conta. Peça a um administrador para vincular o pilar em Usuários, ou volte ao início para ver os pilares disponíveis.',
};

export const ABSENTEEISM_PILLAR_DENIED: AccessDeniedCopy = {
  title: 'Sem acesso ao pilar Absenteísmo',
  description:
    'Esta página exige o pilar Absenteísmo atribuído à sua conta. Peça a um administrador para vincular o pilar em Usuários, ou volte ao início para ver os pilares disponíveis.',
};
