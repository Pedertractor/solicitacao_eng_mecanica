import { ROUTES } from '@/routes/constants';

/** Login keeps its own design; indicators retain the original application theme. */
export function usesPederflowTheme(pathname: string) {
  return ![ROUTES.LOGIN, ROUTES.INDICADORES].some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
