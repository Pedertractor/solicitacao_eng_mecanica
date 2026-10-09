import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { userApi } from '@/services/user';
import { ROUTES } from '@/routes/constants';
import { useAuth } from '@/contexts/useAuth';
import { canApproveUsers } from '@/config/permissions';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-muted text-foreground'
      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
  );

export function UsersLayout() {
  const { user: authUser } = useAuth();
  const showRequestsTab =
    authUser?.role != null && canApproveUsers(authUser.role);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.listAll(),
    enabled: showRequestsTab,
  });

  const pendingCount = users.filter((u) => u.approvalStatus === 'PENDING').length;

  return (
    <div className='space-y-6'>
      <div>
        <h1>Usuários</h1>
        <p className='text-muted-foreground'>
          Gerencie contas do painel e analise pedidos de acesso enviados pelo
          cadastro público.
        </p>
      </div>

      {showRequestsTab ? (
        <nav
          className='flex flex-wrap gap-1 border-b border-border pb-px'
          aria-label='Seções de usuários'
        >
          <NavLink to={ROUTES.USUARIOS} end className={tabClass}>
            Todos os usuários
          </NavLink>
          <NavLink to={ROUTES.USUARIOS_SOLICITACOES} className={tabClass}>
            Solicitações de acesso
            {pendingCount > 0 ? (
              <Badge variant='secondary' className='tabular-nums'>
                {pendingCount}
              </Badge>
            ) : null}
          </NavLink>
        </nav>
      ) : null}

      <Outlet />
    </div>
  );
}
