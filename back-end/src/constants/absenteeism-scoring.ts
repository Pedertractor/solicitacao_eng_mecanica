/** Pontuação máxima P5 do pilar Absenteísmo (10% do ciclo mensal). */
export const ABSENTEEISM_P5_MAX = 10;

/** Pontuação interna total do pilar Absenteísmo. */
export const ABSENTEEISM_INTERNAL_MAX = 100;

/** Parcela individual legada (40 pts internos → até 4 P5) — ciclos antigos. */
export const ABSENTEEISM_INDIVIDUAL_POINTS = 40;

/** Parcela setorial reservada em ciclos legados (60 pts internos → 6 P5). */
export const ABSENTEEISM_SECTOR_PLACEHOLDER = 60;

/** Índice mínimo da procedure: abaixo disso gera ocorrência de fábrica. */
export const ABSENTEEISM_INDEX_THRESHOLD = 100;

/** Perda individual padrão (P5) de quem fica abaixo de 100. */
export const DEFAULT_ABSENTEEISM_INDIVIDUAL_PENALTY_P5 = 10;

/** Perda coletiva padrão (P5) por colaborador abaixo de 100. */
export const DEFAULT_ABSENTEEISM_FACTORY_DEDUCTION_P5 = 1;

export const ABSENTEEISM_INDICATOR_CODE = 'ABSENTEEISM_INDIVIDUAL';

/** Cron diário no ciclo aberto: o mês ainda não fechou. */
export const ABSENTEEISM_PARTIAL_WARNING =
  'Resultado parcial: o índice do mês ainda pode mudar até o fechamento.';

/** Cron diário + índice < 100: mostra a perda com aviso de parcial. */
export const ABSENTEEISM_PARTIAL_DEDUCTION_WARNING =
  'Resultado parcial: o índice está abaixo de 100 (perda individual + coletiva da fábrica). Isso pode mudar até o fechamento do mês.';
