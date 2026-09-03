import { SolicitationService } from '../services/solicitation-service.js';

const DEFAULT_INTERVAL_MS = 60_000;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function runSync() {
  if (running) {
    return;
  }

  running = true;
  try {
    const service = new SolicitationService();
    const result = await service.syncPendingFromKairo();
    if (result.completed > 0) {
      console.log(
        `[kairo-sync] Verificadas ${result.checked}; concluídas ${result.completed}`,
      );
    }
  } catch (error) {
    console.error('[kairo-sync] Falha no job periódico:', error);
  } finally {
    running = false;
  }
}

export function startKairoSyncJob(intervalMs = DEFAULT_INTERVAL_MS) {
  if (timer) {
    return;
  }

  void runSync();
  timer = setInterval(() => {
    void runSync();
  }, intervalMs);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

export function stopKairoSyncJob() {
  if (!timer) {
    return;
  }
  clearInterval(timer);
  timer = null;
}
