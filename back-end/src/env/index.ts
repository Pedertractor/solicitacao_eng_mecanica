import z from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.string().default('3030'),
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('12h'),
  APPNAME: z.string(),
  APPKEY: z.string(),
  API_PEDERTRACTOR_URL: z.string(),
  ORION_URL: z.string().optional(),
  ORION_APP_TOKEN: z.string().optional(),
  CIPA_API_URL: z.string().optional(),
  CIPA_API_KEY: z.string().optional(),
  FIREBIRD_HOST: z
    .string()
    .transform((value) => value.replace(/[^\x00-\x7F]/g, '').trim()),
  FIREBIRD_PORT: z.string().transform((value) => value.trim()),
  FIREBIRD_USER: z.string().transform((value) => value.trim()),
  FIREBIRD_PASSWORD: z.string(),
  FIREBIRD_PATH: z.string().transform((value) => value.trim()),
  FIREBIRD_ROLE: z
    .string()
    .optional()
    .transform((value) => value?.trim() || 'PROJETO_ROLE'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  const err = z.treeifyError(_env.error).properties;
  console.error('Variáveis de ambiente inválidas:', err);
  throw new Error('Variáveis de ambiente inválidas');
}

export const env = _env.data;
