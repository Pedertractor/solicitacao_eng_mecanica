import { app } from './app.js';
import { env } from './env/index.js';
import { startKairoSyncJob } from './jobs/kairo-sync-job.js';

app.listen({ host: env.HOST, port: +env.PORT }).then(() => {
  console.log('Server running!', env.HOST + ':' + env.PORT);
  startKairoSyncJob();
});
