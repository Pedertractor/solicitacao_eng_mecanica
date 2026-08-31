/** Única chave usada para o token de autenticação. Não usar "token" (legado). */
const AUTH_TOKEN_KEY = 'auth_token';

const LEGACY_TOKEN_KEY = 'token';

export function getStoredToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

/** Remove o token de autenticação e a chave legada "token" se existir. */
export function clearAuthStorage(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}
