import * as React from 'react';
import { ChevronsUpDownIcon } from 'lucide-animated';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import type { AnimatedIconHandle, SidebarIcon } from '@/config/sidebar';

type Team = {
  name: string;
  logo: SidebarIcon;
  plan: string;
};

export function TeamSwitcher({ teams }: { teams: Team[] }) {
  const { isMobile } = useSidebar();
  const [activeTeam, setActiveTeam] = React.useState<Team | undefined>(
    () => teams[0],
  );
  const logoRef = React.useRef<AnimatedIconHandle>(null);
  const chevronRef = React.useRef<AnimatedIconHandle>(null);

  const current = teams.find((t) => t.name === activeTeam?.name) ?? teams[0];

  if (!current) {
    return null;
  }

  const startHover = () => {
    logoRef.current?.startAnimation();
    chevronRef.current?.startAnimation();
  };
  const stopHover = () => {
    logoRef.current?.stopAnimation();
    chevronRef.current?.stopAnimation();
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
              onMouseEnter={startHover}
              onMouseLeave={stopHover}
            >
              <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
                <current.logo ref={logoRef} size={16} className='shrink-0' />
              </div>
              <div className='grid flex-1 text-left text-sm leading-tight'>
                <span className='truncate font-medium'>{current.name}</span>
                <span className='truncate text-xs'>{current.plan}</span>
              </div>
              <ChevronsUpDownIcon
                ref={chevronRef}
                size={16}
                className='ml-auto shrink-0'
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
            align='start'
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className='text-muted-foreground text-xs'>
              App
            </DropdownMenuLabel>
            {teams.map((team) => (
              <DropdownMenuItem
                key={team.name}
                onClick={() => setActiveTeam(team)}
                className='gap-2 p-2'
              >
                <div className='flex size-6 items-center justify-center rounded-md border'>
                  <team.logo size={14} className='shrink-0' />
                </div>
                {team.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
