import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PlatformPageShell } from '@/components/platform-backdrop';
import { useAuth } from '@/contexts/useAuth';
import { ROUTES } from '@/routes/constants';

export function ProtectedRoute() {
  const { isLoggedIn, isAuthReady, user } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

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

  if (user?.mustChangePassword) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return <Outlet />;
}
