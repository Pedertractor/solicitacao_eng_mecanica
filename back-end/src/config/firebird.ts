import Firebird from 'node-firebird';
import { env } from '../env/index.js';

const options: Firebird.Options = {
  host: env.FIREBIRD_HOST,
  port: env.FIREBIRD_PORT ? Number(env.FIREBIRD_PORT) : 3050,
  database: env.FIREBIRD_PATH,
  user: env.FIREBIRD_USER,
  password: env.FIREBIRD_PASSWORD,
  role: env.FIREBIRD_ROLE,
  encoding: 'UTF8',
  lowercase_keys: false,
};

export function queryDatabase<T = unknown>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    Firebird.attach(options, (err, db) => {
      if (err) {
        return reject(err);
      }

      db.query(sql, params, (queryErr, result) => {
        db.detach();
        if (queryErr) {
          return reject(queryErr);
        }
        resolve((result ?? []) as T[]);
      });
    });
  });
}
