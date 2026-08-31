import { Outlet, useLocation } from 'react-router-dom';

import { AppSidebar } from '@/components/app-sidebar';
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

function breadcrumbLabel(pathname: string): string {
  if (pathname === ROUTES.HOME || pathname === '') return 'Programa P5';
  if (pathname.startsWith(ROUTES.SIMULACAO)) return 'Simulação';
  if (pathname.startsWith(ROUTES.USUARIOS_NOVO)) return 'Novo usuário';
  if (pathname.startsWith(ROUTES.USUARIOS)) return 'Usuários';
  if (pathname.includes('/seguranca')) return 'P5 · Segurança';
  if (pathname.startsWith(ROUTES.P5_CONFIGURACOES)) return 'P5 · Configurações';
  if (pathname.startsWith(ROUTES.P5_CICLOS) && pathname !== ROUTES.P5_CICLOS) {
    return 'P5 · Ciclo';
  }
  if (pathname.startsWith(ROUTES.P5_CICLOS)) return 'P5 · Ciclos';
  if (pathname.startsWith(ROUTES.P5)) return 'Programa P5';
  return 'Project P5';
}

export function MainLayout() {
  const { pathname } = useLocation();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className='min-w-0'>
        <header className='flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12'>
          <div className='flex items-center gap-2 px-4'>
            <SidebarTrigger className='-ml-1' />
            <Separator
              orientation='vertical'
              className='mr-2 data-[orientation=vertical]:h-4'
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>{breadcrumbLabel(pathname)}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className='flex min-w-0 flex-1 flex-col gap-4 p-4 pt-0'>
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
