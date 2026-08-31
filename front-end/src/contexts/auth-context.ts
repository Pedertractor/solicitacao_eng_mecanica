import { createContext } from 'react';
import type { AuthUser } from '@/types/auth';

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoggedIn: boolean;
  /** True when there is no token to resolve, or after /me (or login) settled user state */
  isAuthReady: boolean;
  isLoading: boolean;
  login: (credentials: {
    cardNumber: string;
    unit: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  /** Atualiza o usuário no contexto (ex.: após trocar senha no primeiro login) */
  updateUser: (user: AuthUser) => void;
  /** Recarrega perfil do servidor (papel, permissões de UI) sem novo login */
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
