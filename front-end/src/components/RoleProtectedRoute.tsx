import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { ROUTES } from '@/routes/constants';
import { canRoleAccessPath } from '@/config/roleAccess';

export function RoleProtectedRoute() {
  const { user, isAuthReady } = useAuth();
  const location = useLocation();

  if (!isAuthReady) {
    return (
      <div className='flex h-screen items-center justify-center bg-background'>
        <p className='text-muted-foreground'>A carregar…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
    );
  }

  if (!canRoleAccessPath(user.role, location.pathname, user.assignedPillarCodes)) {
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
