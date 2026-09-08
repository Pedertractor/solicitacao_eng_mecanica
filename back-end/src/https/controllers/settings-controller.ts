import z from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SettingsService } from '../../services/settings-service.js';

export async function getEmailCc(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const service = new SettingsService();
  const emails = await service.getEmailCc();
  return reply.status(200).send({ emails });
}

export async function updateEmailCc(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const bodySchema = z.object({
    emails: z.array(z.email('E-mail inválido')),
  });
  const { emails } = bodySchema.parse(request.body);
  const service = new SettingsService();
  const saved = await service.setEmailCc(emails, request.user.sub);
  return reply.status(200).send({ emails: saved });
}
