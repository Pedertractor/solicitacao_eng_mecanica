import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RoleProtectedRoute } from '@/components/RoleProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { UserListPage } from '@/pages/Usuarios/UserListPage';
import { UserSignupRequestsPage } from '@/pages/Usuarios/UserSignupRequestsPage';
import { UsersLayout } from '@/pages/Usuarios/UsersLayout';
import { NewUserPage } from '@/pages/Usuarios/NewUserPage';
import { PublicSolicitationPage } from '@/pages/Solicitacao/PublicSolicitationPage';
import { PublicSolicitationTrackPage } from '@/pages/Solicitacao/PublicSolicitationTrackPage';
import { SolicitationListPage } from '@/pages/Solicitacao/SolicitationListPage';
import { SolicitationDetailPage } from '@/pages/Solicitacao/SolicitationDetailPage';
import { SettingsPage } from '@/pages/Configuracoes/SettingsPage';
import { ROUTES } from './constants';

export { ROUTES } from './constants';

const router = createBrowserRouter([
  {
    path: ROUTES.LOGIN,
    element: <LoginPage />,
  },
  {
    path: ROUTES.CADASTRO,
    element: <RegisterPage />,
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
              {
                path: ROUTES.USUARIOS,
                element: <UsersLayout />,
                children: [
                  { index: true, element: <UserListPage /> },
                  {
                    path: 'solicitacoes',
                    element: <UserSignupRequestsPage />,
                  },
                ],
              },
              { path: ROUTES.USUARIOS_NOVO, element: <NewUserPage /> },
              { path: ROUTES.CONFIGURACOES, element: <SettingsPage /> },
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
