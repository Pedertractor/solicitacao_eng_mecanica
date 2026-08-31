import type {
  ComponentPropsWithoutRef,
  ForwardRefExoticComponent,
  HTMLAttributes,
  RefAttributes,
} from 'react';
import {
  CalendarDaysIcon,
  FlaskIcon,
  HomeIcon,
  LayoutGridIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-animated';
import { ROUTES } from '@/routes/constants';

/** Handle comum dos ícones lucide-animated. */
export type AnimatedIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

/** Ícone animado da sidebar (lucide-animated) — anima no hover da área do link. */
export type SidebarIcon = ForwardRefExoticComponent<
  {
    size?: number;
    className?: string;
    animateOnHover?: boolean;
  } & HTMLAttributes<HTMLDivElement> &
    RefAttributes<AnimatedIconHandle>
>;

export type SidebarIconProps = ComponentPropsWithoutRef<SidebarIcon>;

export interface SidebarNavChild {
  path: string;
  label: string;
  icon?: SidebarIcon;
}

export interface SidebarNavItem {
  path: string;
  label: string;
  icon: SidebarIcon;
  children?: SidebarNavChild[];
}

/** Subitens do Home (Programa P5) — só para quem acessa a área P5. */
export const HOME_NAV_CHILDREN: SidebarNavChild[] = [
  { path: ROUTES.HOME, label: 'Visão geral', icon: HomeIcon },
  { path: ROUTES.P5_CICLOS, label: 'Ciclos', icon: CalendarDaysIcon },
  {
    path: ROUTES.P5_PAINEL_PONTUACAO,
    label: 'Painel de pontuação',
    icon: SettingsIcon,
  },
  { path: ROUTES.P5_CONFIGURACOES, label: 'Configurações', icon: SettingsIcon },
];

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { path: ROUTES.HOME, label: 'P5', icon: LayoutGridIcon },
  { path: ROUTES.SIMULACAO, label: 'Simulação', icon: FlaskIcon },
  { path: ROUTES.USUARIOS, label: 'Usuários', icon: UsersIcon },
];
