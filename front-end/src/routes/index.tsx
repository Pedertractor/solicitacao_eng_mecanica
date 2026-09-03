import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RoleProtectedRoute } from '@/components/RoleProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { UserListPage } from '@/pages/Usuarios/UserListPage';
import { NewUserPage } from '@/pages/Usuarios/NewUserPage';
import { PublicSolicitationPage } from '@/pages/Solicitacao/PublicSolicitationPage';
import { PublicSolicitationTrackPage } from '@/pages/Solicitacao/PublicSolicitationTrackPage';
import { SolicitationListPage } from '@/pages/Solicitacao/SolicitationListPage';
import { SolicitationDetailPage } from '@/pages/Solicitacao/SolicitationDetailPage';
import { ROUTES } from './constants';

export { ROUTES } from './constants';

const router = createBrowserRouter([
  {
    path: ROUTES.LOGIN,
    element: <LoginPage />,
  },
  {
    path: ROUTES.SOLICITACAO,
    element: <PublicSolicitationPage />,
  },
  {
    path: ROUTES.SOLICITACAO_ACOMPANHAR,
    element: <PublicSolicitationTrackPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <RoleProtectedRoute />,
        children: [
          {
            path: ROUTES.HOME,
            element: <MainLayout />,
            children: [
              {
                index: true,
                element: <Navigate to={ROUTES.SOLICITACOES} replace />,
              },
              {
                path: ROUTES.SOLICITACOES,
                element: <SolicitationListPage />,
              },
              {
                path: ROUTES.SOLICITACAO_DETALHE,
                element: <SolicitationDetailPage />,
              },
              { path: ROUTES.USUARIOS, element: <UserListPage /> },
              { path: ROUTES.USUARIOS_NOVO, element: <NewUserPage /> },
              {
                path: ROUTES.NOT_FOUND,
                element: <NotFoundPage />,
              },
            ],
          },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
