import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { getHomePathForRole } from '@/config/roleAccess';
import { ROUTES } from '@/routes/constants';

export function HomeRedirect() {
  const { user } = useAuth();
  const path = user?.role
    ? getHomePathForRole(user.role, user.department)
    : ROUTES.SOLICITACOES;
  return <Navigate to={path} replace />;
}
