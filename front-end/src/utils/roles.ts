export const formattedRoles: Record<string, string> = {
  USER: 'Usuário',
  ADMIN: 'Admin',
};

export function roleLabel(role: string): string {
  return formattedRoles[role] ?? role;
}
