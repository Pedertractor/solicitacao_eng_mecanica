import type {
  ComponentPropsWithoutRef,
  ForwardRefExoticComponent,
  HTMLAttributes,
  RefAttributes,
} from 'react';
import { LayoutGridIcon, UsersIcon } from 'lucide-animated';
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

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { path: ROUTES.SOLICITACOES, label: 'Solicitações', icon: LayoutGridIcon },
  { path: ROUTES.USUARIOS, label: 'Usuários', icon: UsersIcon },
];
