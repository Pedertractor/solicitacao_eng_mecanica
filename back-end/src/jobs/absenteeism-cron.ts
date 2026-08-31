import cron from 'node-cron';
import { AbsenteeismCalculationService } from '../services/absenteeism-calculation-service.js';

/** Retenta o mês anterior e grava resultado parcial no ciclo aberto. */
export function startAbsenteeismCron() {
  cron.schedule(
    '30 0 * * *',
    async () => {
      try {
        const { previous, current } =
          await new AbsenteeismCalculationService().applyDailyUpdates();
        const previousApplied = previous.filter(
          (result) => result.status === 'applied',
        );
        const currentApplied = current.filter(
          (result) => result.status === 'applied',
        );
        if (previousApplied.length > 0) {
          console.log(
            `Absenteeism cron: ${previousApplied.length} ciclo(s) do mês anterior atualizado(s).`,
          );
        }
        if (currentApplied.length > 0) {
          console.log(
            `Absenteeism cron: ${currentApplied.length} ciclo(s) aberto(s) atualizado(s) (parcial).`,
          );
        }
      } catch (error) {
        console.error('Absenteeism cron: erro na execução diária:', error);
      }
    },
    { timezone: 'America/Sao_Paulo' },
  );

  console.log(
    'Absenteeism cron agendado: diariamente às 00:30 (America/Sao_Paulo).',
  );
}
