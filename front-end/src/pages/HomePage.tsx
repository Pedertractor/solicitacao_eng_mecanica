import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { canAccessP5Area } from '@/config/permissions';
import {
  getHomeNoAccessCopy,
  getRedirectAccessDeniedCopy,
} from '@/config/accessMessages';
import { AccessDeniedState } from '@/components/AccessDeniedState';
import { P5DashboardPage } from '@/pages/P5/P5DashboardPage';

type LocationAccessState = {
  accessDenied?: boolean;
};

export function HomePage() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const accessDenied = Boolean(
    (location.state as LocationAccessState | null)?.accessDenied,
  );

  if (isLoading || !user) {
    return (
      <div className='flex min-h-50 items-center justify-center'>
        <p className='text-muted-foreground'>Carregando...</p>
      </div>
    );
  }

  if (canAccessP5Area(user) && !accessDenied) {
    return <P5DashboardPage />;
  }

  const copy = accessDenied
    ? getRedirectAccessDeniedCopy(user)
    : getHomeNoAccessCopy(user);

  return (
    <AccessDeniedState
      title={copy.title}
      description={copy.description}
      showHomeLink={accessDenied && canAccessP5Area(user)}
    />
  );
}
