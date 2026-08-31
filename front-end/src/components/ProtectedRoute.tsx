import { Navigate, Outlet, useLocation } from 'react-router-dom';
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
      <div className='flex h-screen items-center justify-center bg-background'>
        <p className='text-muted-foreground'>A carregar…</p>
      </div>
    );
  }

  if (user?.mustChangePassword) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return <Outlet />;
}
