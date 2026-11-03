import { useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { usesPederflowTheme } from '@/config/platform-theme';
import '@/styles/pederflow.css';

export function PlatformThemeLayout() {
  const { pathname } = useLocation();
  const themed = usesPederflowTheme(pathname);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.getAttribute('data-platform-theme');
    root.setAttribute('data-platform-theme', themed ? 'pederflow' : 'original');

    return () => {
      if (previousTheme === null) root.removeAttribute('data-platform-theme');
      else root.setAttribute('data-platform-theme', previousTheme);
    };
  }, [themed]);

  return <Outlet />;
}
