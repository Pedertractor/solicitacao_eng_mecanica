import z from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.string().default('3142'),
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('12h'),
  APPNAME: z.string(),
  APPKEY: z.string(),
  API_PEDERTRACTOR_URL: z.string(),
  KAIRO_API_URL: z.string().optional(),
  KAIRO_CREDENTIALS_SECRET: z.string().optional(),
  CORREIO: z.string(),
  EMAIL_AUTOMACAO: z.string().email(),
  PASSWORD_AUTOMACAO: z.string().min(1),
  PORT_CORREIO: z.string().default('587'),
  PUBLIC_FRONTEND_URL: z.string().url(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  const err = z.treeifyError(_env.error).properties;
  console.error('Variáveis de ambiente inválidas:', err);
  throw new Error('Variáveis de ambiente inválidas');
}

export const env = _env.data;
