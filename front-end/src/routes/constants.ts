/**
 * Constantes de rotas. Arquivo separado para evitar dependência circular
 * (config/sidebar e outros podem importar ROUTES sem carregar o router).
 */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  USUARIOS: '/usuarios',
  USUARIOS_NOVO: '/usuarios/novo',
  SIMULACAO: '/simulacao',
  P5: '/p5',
  P5_CICLOS: '/p5/ciclos',
  P5_CICLO_DETALHE: '/p5/ciclos/:cycleId',
  P5_CICLO_SEGURANCA: '/p5/ciclos/:cycleId/seguranca',
  P5_CICLO_ABSENTEISMO: '/p5/ciclos/:cycleId/absenteismo',
  P5_CONFIGURACOES: '/p5/configuracoes',
  P5_PAINEL_PONTUACAO: '/p5/painel-pontuacao',
  NOT_FOUND: '*',
} as const;

export function p5CyclePath(cycleId: string) {
  return `/p5/ciclos/${cycleId}`;
}

export function p5SafetyPath(cycleId: string) {
  return `/p5/ciclos/${cycleId}/seguranca`;
}

export function p5AbsenteeismPath(cycleId: string) {
  return `/p5/ciclos/${cycleId}/absenteismo`;
}
