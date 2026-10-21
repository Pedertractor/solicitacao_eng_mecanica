import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { AppPageContainer, PageHero } from '@/components/layout';
import { userApi } from '@/services/user';
import { ROUTES } from '@/routes/constants';
import { useAuth } from '@/contexts/useAuth';
import { canApproveUsers } from '@/config/permissions';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-primary text-primary-foreground shadow-sm'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  );

export function UsersLayout() {
  const { user: authUser } = useAuth();
  const showRequestsTab =
    authUser?.role != null &&
    canApproveUsers(authUser.role, authUser.department);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.listAll(),
    enabled: showRequestsTab,
  });

  const pendingCount = users.filter(
    (u) => u.approvalStatus === 'PENDING',
  ).length;

  return (
    <AppPageContainer>
      <PageHero
        eyebrow='Administração'
        eyebrowIcon={Users}
        title='Usuários'
        description='Gerencie contas do painel e analise pedidos de acesso enviados pelo cadastro público.'
      />

      {showRequestsTab ? (
        <nav
          className='flex flex-wrap gap-1 rounded-2xl border border-border/70 bg-card p-1.5 shadow-sm'
          aria-label='Seções de usuários'
        >
          <NavLink to={ROUTES.USUARIOS} end className={tabClass}>
            Todos os usuários
          </NavLink>
          <NavLink to={ROUTES.USUARIOS_SOLICITACOES} className={tabClass}>
            Solicitações de acesso
            {pendingCount > 0 ? (
              <Badge
                variant='secondary'
                className='tabular-nums'
              >
                {pendingCount}
              </Badge>
            ) : null}
          </NavLink>
        </nav>
      ) : null}

      <Outlet />
    </AppPageContainer>
  );
}
