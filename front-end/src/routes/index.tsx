import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RoleProtectedRoute } from '@/components/RoleProtectedRoute';
import { HomePage } from '@/pages/HomePage';
import { SimulacaoPage } from '@/pages/SimulacaoPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { UserListPage } from '@/pages/Usuarios/UserListPage';
import { NewUserPage } from '@/pages/Usuarios/NewUserPage';
import { P5CyclesPage } from '@/pages/P5/P5CyclesPage';
import { P5CycleDetailPage } from '@/pages/P5/P5CycleDetailPage';
import { P5SafetyPage } from '@/pages/P5/P5SafetyPage';
import { P5AbsenteeismPage } from '@/pages/P5/P5AbsenteeismPage';
import { P5ConfigPage } from '@/pages/P5/P5ConfigPage';
import { P5ScoringPanelPage } from '@/pages/P5/P5ScoringPanelPage';
import { ROUTES } from './constants';

export { ROUTES } from './constants';

const router = createBrowserRouter([
  {
    path: ROUTES.LOGIN,
    element: <LoginPage />,
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
                element: <HomePage />,
              },
              { path: ROUTES.SIMULACAO, element: <SimulacaoPage /> },
              { path: ROUTES.USUARIOS, element: <UserListPage /> },
              { path: ROUTES.USUARIOS_NOVO, element: <NewUserPage /> },
              {
                path: ROUTES.P5,
                element: <Navigate to={ROUTES.HOME} replace />,
              },
              { path: ROUTES.P5_CICLOS, element: <P5CyclesPage /> },
              {
                path: ROUTES.P5_CICLO_DETALHE,
                element: <P5CycleDetailPage />,
              },
              {
                path: ROUTES.P5_CICLO_SEGURANCA,
                element: <P5SafetyPage />,
              },
              {
                path: ROUTES.P5_CICLO_ABSENTEISMO,
                element: <P5AbsenteeismPage />,
              },
              {
                path: ROUTES.P5_CONFIGURACOES,
                element: <P5ConfigPage />,
              },
              {
                path: ROUTES.P5_PAINEL_PONTUACAO,
                element: <P5ScoringPanelPage />,
              },
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

export default AppRouter;
