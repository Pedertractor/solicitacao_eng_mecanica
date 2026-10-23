import Fastify from 'fastify';
import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ secret: 'test-shared-secret-at-least-32-characters', sync: vi.fn() }));
vi.mock('../../env/index.js', () => ({ env: { KAIRO_WEBHOOK_SECRET: mocks.secret } }));
vi.mock('../../services/kairo-webhook-service.js', () => ({ syncKairoWebhookCard: mocks.sync }));
import { kairoWebhookRoutes } from './kairo-webhook-route.js';

const event = { eventId: 'event-1', type: 'card.updated', teamId: 'team-1', cardId: 'card-1' };
function signed(payload: unknown, timestamp = String(Math.floor(Date.now() / 1000))) {
  return { 'x-kairo-timestamp': timestamp, 'x-kairo-signature': createHmac('sha256', mocks.secret)
    .update(`${timestamp}.${JSON.stringify(payload)}`).digest('hex') };
}
afterEach(() => vi.resetAllMocks());

describe('POST /api/webhooks/kairo', () => {
  async function send(payload: unknown, headers: Record<string, string> = signed(payload)) {
    const app = Fastify();
    app.register(kairoWebhookRoutes, { prefix: '/api/webhooks' });
    try {
      return await app.inject({ method: 'POST', url: '/api/webhooks/kairo', payload: JSON.stringify(payload),
        headers: { 'content-type': 'application/json', ...headers } });
    } finally { await app.close(); }
  }
  it('authenticates a server event without a user JWT and synchronizes the specified card', async () => {
    mocks.sync.mockResolvedValue({ synced: 1 });
    const response = await send(event);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ synced: 1 });
    expect(mocks.sync).toHaveBeenCalledWith('team-1', 'card-1');
  });
  it('rejects missing signatures and tampered payloads before synchronization', async () => {
    expect((await send(event, {})).statusCode).toBe(401);
    expect((await send({ ...event, cardId: 'another-card' }, signed(event))).statusCode).toBe(401);
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it('rejects old and future events even with a valid signature', async () => {
    for (const offset of [-600, 600]) {
      expect((await send(event, signed(event, String(Math.floor(Date.now() / 1000) + offset)))).statusCode).toBe(401);
    }
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it('rejects malformed or unsupported signed events', async () => {
    expect((await send({ ...event, cardId: '' })).statusCode).toBe(400);
    expect((await send({ ...event, type: 'unknown' })).statusCode).toBe(400);
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it('returns a retryable failure if synchronization fails', async () => {
    mocks.sync.mockRejectedValue(new Error('Kairo offline'));
    expect((await send(event)).statusCode).toBe(503);
  });
});
