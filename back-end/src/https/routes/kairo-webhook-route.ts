import type { FastifyInstance } from 'fastify';
import { env } from '../../env/index.js';
import { verifyKairoWebhook } from '../../lib/kairo-webhook-signature.js';
import { syncKairoWebhookCard } from '../../services/kairo-webhook-service.js';

export async function kairoWebhookRoutes(app: FastifyInstance) {
  app.post('/kairo', { bodyLimit: 4096 }, async (request, reply) => {
    const secret = env.KAIRO_WEBHOOK_SECRET;
    if (!secret) return reply.code(503).send({ error: 'Webhook Kairo não configurado' });
    if (!verifyKairoWebhook(request.body, request.headers['x-kairo-timestamp'],
      request.headers['x-kairo-signature'], secret)) {
      return reply.code(401).send({ error: 'Assinatura do webhook inválida' });
    }
    const body = request.body as Record<string, unknown> | null;
    if (!body || body.type !== 'card.updated' || typeof body.eventId !== 'string' ||
        !body.eventId || body.eventId.length > 128 ||
        typeof body.teamId !== 'string' || !body.teamId || body.teamId.length > 128 ||
        typeof body.cardId !== 'string' || !body.cardId || body.cardId.length > 128) {
      return reply.code(400).send({ error: 'Evento Kairo inválido' });
    }
    try {
      return await syncKairoWebhookCard(body.teamId, body.cardId);
    } catch {
      request.log.error({ eventId: body.eventId, cardId: body.cardId }, 'Falha na sincronização do webhook Kairo');
      return reply.code(503).send({ error: 'Falha temporária na sincronização' });
    }
  });
}
