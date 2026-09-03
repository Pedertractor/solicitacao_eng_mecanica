import { useCallback, useRef, type ReactNode } from 'react';
import { ChevronRightIcon } from 'lucide-animated';
import { Link, useLocation } from 'react-router-dom';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import type { AnimatedIconHandle, SidebarIcon } from '@/config/sidebar';
import {
  pathMatchesNavExact,
  pathMatchesNavSegment,
} from '@/config/roleAccess';

const SIDEBAR_ICON_SIZE = 16;

function useSidebarIconHover(icon: SidebarIcon) {
  const ref = useRef<AnimatedIconHandle>(null);
  const Icon = icon;
  const onMouseEnter = useCallback(() => {
    ref.current?.startAnimation();
  }, []);
  const onMouseLeave = useCallback(() => {
    ref.current?.stopAnimation();
  }, []);
  const iconNode = (
    <Icon ref={ref} size={SIDEBAR_ICON_SIZE} className='shrink-0' />
  );
  return { iconNode, onMouseEnter, onMouseLeave };
}

function IconHoverTarget({
  icon,
  children,
}: {
  icon: SidebarIcon;
  children: (props: {
    icon: ReactNode;
    hoverProps: {
      onMouseEnter: () => void;
      onMouseLeave: () => void;
    };
  }) => ReactNode;
}) {
  const { iconNode, onMouseEnter, onMouseLeave } = useSidebarIconHover(icon);

  return (
    <>
      {children({
        icon: iconNode,
        hoverProps: {
          onMouseEnter,
          onMouseLeave,
        },
      })}
    </>
  );
}

export type NavMainItem = {
  title: string;
  url: string;
  icon?: SidebarIcon;
  items?: {
    title: string;
    url: string;
    icon?: SidebarIcon;
  }[];
};

export function NavMain({ items }: { items: NavMainItem[] }) {
  const { pathname } = useLocation();
  const { state, isMobile } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navegação</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const hasChildren = Boolean(item.items?.length);
          const parentActive = pathMatchesNavSegment(pathname, item.url);

          if (!hasChildren) {
            if (!item.icon) {
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={parentActive}
                  >
                    <Link to={item.url}>
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            }

            return (
              <SidebarMenuItem key={item.title}>
                <IconHoverTarget icon={item.icon}>
                  {({ icon, hoverProps }) => (
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={parentActive}
                    >
                      <Link to={item.url} {...hoverProps}>
                        {icon}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </IconHoverTarget>
              </SidebarMenuItem>
            );
          }

          if (collapsed) {
            return (
              <SidebarMenuItem key={item.title}>
                <DropdownMenu>
                  {item.icon ? (
                    <IconHoverTarget icon={item.icon}>
                      {({ icon, hoverProps }) => (
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuButton
                            tooltip={item.title}
                            isActive={parentActive}
                            {...hoverProps}
                          >
                            {icon}
                            <span>{item.title}</span>
                            <ChevronRightIcon
                              size={SIDEBAR_ICON_SIZE}
                              className='ml-auto'
                            />
                          </SidebarMenuButton>
                        </DropdownMenuTrigger>
                      )}
                    </IconHoverTarget>
                  ) : (
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={parentActive}
                      >
                        <span>{item.title}</span>
                        <ChevronRightIcon
                          size={SIDEBAR_ICON_SIZE}
                          className='ml-auto'
                        />
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                  )}
                  <DropdownMenuContent
                    className='w-52'
                    side='right'
                    align='start'
                    sideOffset={4}
                  >
                    <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
                    {item.items!.map((sub) =>
                      sub.icon ? (
                        <IconHoverTarget key={sub.url} icon={sub.icon}>
                          {({ icon, hoverProps }) => (
                            <DropdownMenuItem asChild>
                              <Link to={sub.url} {...hoverProps}>
                                {icon}
                                <span>{sub.title}</span>
                              </Link>
                            </DropdownMenuItem>
                          )}
                        </IconHoverTarget>
                      ) : (
                        <DropdownMenuItem key={sub.url} asChild>
                          <Link to={sub.url}>
                            <span>{sub.title}</span>
                          </Link>
                        </DropdownMenuItem>
                      ),
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            );
          }

          return (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={parentActive}
              className='group/collapsible'
            >
              <SidebarMenuItem>
                {item.icon ? (
                  <IconHoverTarget icon={item.icon}>
                    {({ icon, hoverProps }) => (
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={parentActive}
                          {...hoverProps}
                        >
                          {icon}
                          <span>{item.title}</span>
                          <ChevronRightIcon
                            size={SIDEBAR_ICON_SIZE}
                            className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90'
                          />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                    )}
                  </IconHoverTarget>
                ) : (
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={parentActive}
                    >
                      <span>{item.title}</span>
                      <ChevronRightIcon
                        size={SIDEBAR_ICON_SIZE}
                        className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90'
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                )}
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items!.map((sub) => (
                      <SidebarMenuSubItem key={sub.url}>
                        {sub.icon ? (
                          <IconHoverTarget icon={sub.icon}>
                            {({ icon, hoverProps }) => (
                              <SidebarMenuSubButton
                                asChild
                                isActive={pathMatchesNavExact(
                                  pathname,
                                  sub.url,
                                )}
                              >
                                <Link to={sub.url} {...hoverProps}>
                                  {icon}
                                  <span>{sub.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            )}
                          </IconHoverTarget>
                        ) : (
                          <SidebarMenuSubButton
                            asChild
                            isActive={pathMatchesNavExact(pathname, sub.url)}
                          >
                            <Link to={sub.url}>
                              <span>{sub.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        )}
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
