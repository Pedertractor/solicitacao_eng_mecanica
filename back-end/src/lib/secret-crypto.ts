import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../env/index.js';
import { HttpError } from '../https/errors/index.js';

function getSecretKey(): Buffer {
  const secret = env.KAIRO_CREDENTIALS_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new HttpError(
      'KAIRO_CREDENTIALS_SECRET não configurado (mínimo 16 caracteres)',
      500,
    );
  }
  return createHash('sha256').update(secret).digest();
}

/** Encrypts plaintext with AES-256-GCM. Format: iv:authTag:ciphertext (hex). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getSecretKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new HttpError('Credencial Kairo inválida', 500);
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getSecretKey(),
    Buffer.from(ivHex, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
