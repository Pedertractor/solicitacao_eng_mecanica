import { Outlet, useLocation } from 'react-router-dom';

import { AppSidebar } from '@/components/app-sidebar';
import { PlatformPageShell } from '@/components/platform-backdrop';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { ROUTES } from '@/routes/constants';
import { usesPederflowTheme } from '@/config/platform-theme';
import { cn } from '@/lib/utils';

function breadcrumbLabel(pathname: string): string {
  if (pathname === ROUTES.HOME || pathname === '') return 'Solicitações';
  if (pathname.startsWith(ROUTES.SOLICITACOES + '/')) return 'Detalhe';
  if (pathname.startsWith(ROUTES.INDICADORES)) return 'Indicadores';
  if (pathname.startsWith(ROUTES.SOLICITACOES)) return 'Solicitações';
  if (pathname.startsWith(ROUTES.WORKFLOW)) return 'Comercial';
  if (pathname.startsWith(ROUTES.AMOSTRAS_PROTOTIPOS)) return 'Amostras e protótipos';
  if (pathname.startsWith(ROUTES.RASTREIO)) return 'Rastreio';
  if (pathname.startsWith(ROUTES.USUARIOS_NOVO)) return 'Novo usuário';
  if (pathname.startsWith(ROUTES.USUARIOS)) return 'Usuários';
  if (pathname.startsWith(ROUTES.PERFIL)) return 'Perfil';
  if (pathname.startsWith(ROUTES.CONFIGURACOES)) return 'Configurações';
  return 'Pederflow';
}

export function MainLayout() {
  const { pathname } = useLocation();
  const themed = usesPederflowTheme(pathname);

  return (
    <PlatformPageShell className={themed ? 'pederflow-workspace' : undefined}>
      <SidebarProvider defaultOpen={false} className='min-h-svh w-full'>
        <AppSidebar branded platformTheme='pederflow' />
        <SidebarInset className='min-w-0 bg-transparent'>
          <header
            className={cn(
              'flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12',
              themed && 'pederflow-app-header',
            )}
          >
            <div className='flex items-center gap-2 px-4'>
              <SidebarTrigger className='-ml-1' />
              <Separator
                orientation='vertical'
                className='mr-2 data-[orientation=vertical]:h-4'
              />
              <div className={themed ? 'pederflow-header-context' : undefined}>
                {themed ? (
                  <span className='pederflow-header-eyebrow'>PLATAFORMA INTERNA</span>
                ) : null}
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbPage>{breadcrumbLabel(pathname)}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </div>
            {themed ? (
              <img
                className='pederflow-header-companies'
                src='/pedertractor-tractorcomponents.svg'
                alt='Pedertractor e Tractorcomponents'
                width={562}
                height={120}
              />
            ) : null}
          </header>
          <div
            className={cn(
              'flex min-w-0 flex-1 flex-col gap-4 p-4 pt-0',
              themed && 'pederflow-page-content',
            )}
          >
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </PlatformPageShell>
  );
}
