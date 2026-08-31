import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/services/auth';
import { setStoredToken, getStoredToken, clearAuthStorage } from '@/utils/auth-storage';
import { AuthContext } from '@/contexts/auth-context';
import type { AuthUser } from '@/types/auth';

// Re-export para compatibilidade (ex.: cache do Vite que pedia clearAuthStorage de AuthContext)
// eslint-disable-next-line react-refresh/only-export-components -- utilitário compartilhado
export { clearAuthStorage } from '@/utils/auth-storage';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [isAuthReady, setAuthReady] = useState(() => !getStoredToken());

  const login = useCallback(
    async (credentials: {
      cardNumber: string;
      unit: string;
      password: string;
    }) => {
      setLoading(true);
      try {
        queryClient.clear();
        const { user: userData, token: newToken } =
          await authApi.login(credentials);
        setUser(userData);
        setStoredToken(newToken);
      } finally {
        setLoading(false);
      }
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    setUser(null);
    clearAuthStorage();
    queryClient.clear();
  }, [queryClient]);

  const updateUser = useCallback((userData: AuthUser) => {
    setUser(userData);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const data = await authApi.getMe(token);
      setUser((previous) => {
        const identityChanged =
          previous != null &&
          (previous.id !== data.user.id ||
            previous.role !== data.user.role ||
            JSON.stringify(previous.assignedPillarCodes ?? []) !==
              JSON.stringify(data.user.assignedPillarCodes ?? []));
        if (identityChanged) {
          void queryClient.invalidateQueries({ queryKey: ['p5'] });
        }
        return data.user;
      });
    } catch {
      setUser(null);
      clearAuthStorage();
      queryClient.clear();
    }
  }, [queryClient]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setAuthReady(true);
      return;
    }
    setAuthReady(false);
    void refreshUser().finally(() => setAuthReady(true));
  }, [refreshUser]);

  useEffect(() => {
    if (!getStoredToken()) return;

    const intervalId = window.setInterval(() => {
      void refreshUser();
    }, 15_000);

    const onFocus = () => {
      void refreshUser();
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshUser();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshUser]);

  const value = useMemo(() => {
    const token = getStoredToken();
    return {
      user,
      token,
      isLoggedIn: !!token,
      isAuthReady,
      isLoading,
      login,
      logout,
      setLoading,
      updateUser,
      refreshUser,
    };
  }, [user, isAuthReady, isLoading, login, logout, updateUser, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
