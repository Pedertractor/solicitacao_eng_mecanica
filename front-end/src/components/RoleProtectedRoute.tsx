import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PlatformPageShell } from '@/components/platform-backdrop';
import { useAuth } from '@/contexts/useAuth';
import { ROUTES } from '@/routes/constants';
import { canRoleAccessPath } from '@/config/roleAccess';

export function RoleProtectedRoute() {
  const { user, isAuthReady } = useAuth();
  const location = useLocation();

  if (!isAuthReady) {
    return (
      <PlatformPageShell
        className='items-center justify-center'
        contentClassName='items-center justify-center'
      >
        <p className='text-muted-foreground'>A carregar…</p>
      </PlatformPageShell>
    );
  }

  if (!user) {
    return (
      <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
    );
  }

  if (!canRoleAccessPath(user.role, location.pathname)) {
    return (
      <Navigate
        to={ROUTES.HOME}
        replace
        state={{ accessDenied: true, attemptedPath: location.pathname }}
      />
    );
  }

  return <Outlet />;
}
