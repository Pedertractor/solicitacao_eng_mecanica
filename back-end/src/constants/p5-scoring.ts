/** Pontuação máxima preservável por colaborador em cada ciclo mensal (soma dos pilares). */
export const MONTHLY_BASE_POINTS = 100;

/** Quantidade de ciclos mensais gerados automaticamente por programa anual. */
export const CYCLES_PER_PROGRAM_YEAR = 12;

/** Pontuação máxima anual por colaborador se preservar 100 em todos os meses. */
export const ANNUAL_BASE_POINTS =
  MONTHLY_BASE_POINTS * CYCLES_PER_PROGRAM_YEAR;
