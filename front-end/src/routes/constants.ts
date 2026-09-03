/**
 * Constantes de rotas. Arquivo separado para evitar dependência circular
 * (config/sidebar e outros podem importar ROUTES sem carregar o router).
 */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SOLICITACAO: '/solicitacao',
  SOLICITACAO_ACOMPANHAR: '/solicitacao/acompanhar/:trackingCode',
  SOLICITACOES: '/solicitacoes',
  SOLICITACAO_DETALHE: '/solicitacoes/:id',
  USUARIOS: '/usuarios',
  USUARIOS_NOVO: '/usuarios/novo',
  NOT_FOUND: '*',
} as const;

export function solicitationDetailPath(id: string) {
  return `/solicitacoes/${id}`;
}

export function solicitationTrackPath(trackingCode: string) {
  return `/solicitacao/acompanhar/${encodeURIComponent(trackingCode)}`;
}
