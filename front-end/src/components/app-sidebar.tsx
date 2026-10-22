import * as React from 'react';
import { CogIcon } from 'lucide-animated';

import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { TeamSwitcher } from '@/components/team-switcher';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/useAuth';
import { getSidebarNavItemsForRole } from '@/config/roleAccess';
import { roleLabel } from '@/utils/roles';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();

  const navItems = user
    ? getSidebarNavItemsForRole(user.role, user.department).map((item) => ({
        title: item.label,
        url: item.path,
        icon: item.icon,
        items: item.children?.map((child) => ({
          title: child.label,
          url: child.path,
          icon: child.icon,
        })),
      }))
    : [];

  const displayRole = user
    ? roleLabel(user.role, user.department)
    : 'App';

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'EM';

  return (
    <Sidebar collapsible='icon' {...props}>
      <SidebarHeader>
        <TeamSwitcher
          teams={[
            {
              name: 'Solicitação Pedertractor',
              logo: CogIcon,
              plan: displayRole,
            },
          ]}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user?.name ?? 'Usuário',
            email: user?.notificationEmail?.trim()
              ? user.notificationEmail
              : user
                ? displayRole
                : '',
            avatar: '',
            initials,
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
