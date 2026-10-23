import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyKairoWebhook(
  body: unknown,
  timestamp: unknown,
  signature: unknown,
  secret: string,
  now = Date.now(),
) {
  if (
    typeof timestamp !== 'string' || !/^\d{10}$/.test(timestamp) ||
    typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)
  ) return false;
  if (Math.abs(now / 1_000 - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${JSON.stringify(body)}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
