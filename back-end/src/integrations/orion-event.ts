import { env } from '../env/index.js';

export type OrionEventBody = {
  userId: string;
  userName?: string;
  cardNumberUser?: string;
  metadata?: Record<string, unknown>;
};

function isOrionConfigured(): boolean {
  return Boolean(env.ORION_URL && env.ORION_APP_TOKEN);
}

export async function notifyOrion(body: OrionEventBody): Promise<void> {
  if (!isOrionConfigured()) {
    return;
  }

  const res = await fetch(env.ORION_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.ORION_APP_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('[orion]', res.status, err);
  }
}
