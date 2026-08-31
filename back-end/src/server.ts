import { app } from './app.js';
import { env } from './env/index.js';
import { startAbsenteeismCron } from './jobs/absenteeism-cron.js';

app.listen({ host: env.HOST, port: +env.PORT }).then(() => {
  console.log('Server running!', env.HOST + ':' + env.PORT);
  startAbsenteeismCron();
});
