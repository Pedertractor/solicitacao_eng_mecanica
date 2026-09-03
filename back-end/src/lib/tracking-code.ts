import { randomBytes } from 'node:crypto';

/** Alphabet without ambiguous chars (0/O, 1/I). */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const PREFIX = 'SEM-';
const CODE_LENGTH = 10;

export function generateTrackingCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i]! % ALPHABET.length]!;
  }
  return `${PREFIX}${code}`;
}
