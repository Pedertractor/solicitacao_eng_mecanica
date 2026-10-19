import z from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { OfService } from '../../services/of-service.js';

export async function getOfProcesses(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    ofNumber: z.string().min(1, 'Número da OF é obrigatório'),
  });
  const { ofNumber } = paramsSchema.parse(request.params);
  const service = new OfService();
  const processes = await service.getProcesses(ofNumber);
  return reply.status(200).send({ processes });
}
