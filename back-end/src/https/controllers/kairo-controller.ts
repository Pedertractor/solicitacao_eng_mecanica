import type { FastifyReply, FastifyRequest } from 'fastify';
import z from 'zod';
import { KairoCredentialService } from '../../services/kairo-credential-service.js';

export async function getMyKairoCredential(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const service = new KairoCredentialService();
  const status = await service.getStatus(request.user.sub);
  return reply.status(200).send(status);
}

export async function putMyKairoCredential(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const bodySchema = z.object({
    apiKey: z.string().min(1, 'Chave de API é obrigatória'),
  });
  const { apiKey } = bodySchema.parse(request.body);
  const service = new KairoCredentialService();
  const status = await service.link(request.user.sub, apiKey);
  return reply.status(200).send(status);
}

export async function deleteMyKairoCredential(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const service = new KairoCredentialService();
  const status = await service.unlink(request.user.sub);
  return reply.status(200).send(status);
}

export async function listMyKairoTeams(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const service = new KairoCredentialService();
  const client = await service.getClientForUser(request.user.sub);
  const { teams } = await client.listTeams();
  await service.touchValidated(request.user.sub);
  return reply.status(200).send({
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      description: team.description,
      active: team.active,
    })),
  });
}

export async function listMyKairoTags(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    teamId: z.string().min(1),
  });
  const { teamId } = paramsSchema.parse(request.params);
  const service = new KairoCredentialService();
  const client = await service.getClientForUser(request.user.sub);
  const { tags } = await client.listTags(teamId);
  await service.touchValidated(request.user.sub);
  return reply.status(200).send({
    tags: tags.map((tag) => ({
      id: tag.id,
      teamId: tag.teamId,
      name: tag.name,
      color: tag.color,
    })),
  });
}
