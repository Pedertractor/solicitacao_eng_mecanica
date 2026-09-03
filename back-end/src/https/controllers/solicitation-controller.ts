import z from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { $Enums } from '../../generated/prisma/client.js';
import { SolicitationService } from '../../services/solicitation-service.js';

export async function validateRequester(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const bodySchema = z.object({
    cardNumber: z.string().min(1, 'Cartão é obrigatório'),
    unit: z.enum($Enums.Unit),
  });
  const { cardNumber, unit } = bodySchema.parse(request.body);
  const service = new SolicitationService();
  const result = await service.validateRequester(cardNumber, unit);
  return reply.status(200).send(result);
}

export async function getSectorByCostCenter(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    costCenter: z.string().min(1, 'Centro de custo é obrigatório'),
  });
  const { costCenter } = paramsSchema.parse(request.params);
  const service = new SolicitationService();
  const sector = await service.getSectorByCostCenter(costCenter);
  return reply.status(200).send(sector);
}

export async function createSolicitation(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const bodySchema = z.object({
    cardNumber: z.string().min(1, 'Cartão é obrigatório'),
    unit: z.enum($Enums.Unit),
    costCenter: z.string().min(1, 'Centro de custo é obrigatório'),
    pillarOrLocation: z.string().min(1, 'Pilar/local é obrigatório'),
    title: z.string().min(1, 'Título é obrigatório'),
    description: z.string().min(1, 'Descrição é obrigatória'),
  });
  const body = bodySchema.parse(request.body);
  const service = new SolicitationService();
  const solicitation = await service.create(body);
  return reply.status(201).send({ solicitation });
}

export async function listSolicitations(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const querySchema = z.object({
    status: z.enum($Enums.SolicitationStatus).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
  });
  const query = querySchema.parse(request.query);
  const service = new SolicitationService();
  const result = await service.list({
    page: query.page,
    pageSize: query.pageSize,
    ...(query.status !== undefined ? { status: query.status } : {}),
  });
  return reply.status(200).send(result);
}

export async function getSolicitationById(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    id: z.string().uuid('ID inválido'),
  });
  const { id } = paramsSchema.parse(request.params);
  const service = new SolicitationService();
  const solicitation = await service.getById(id);
  return reply.status(200).send({ solicitation });
}

export async function getSolicitationByTrackingCode(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    trackingCode: z.string().min(1, 'Código de acompanhamento é obrigatório'),
  });
  const { trackingCode } = paramsSchema.parse(request.params);
  const service = new SolicitationService();
  const solicitation = await service.getByTrackingCode(trackingCode);
  return reply.status(200).send({ solicitation });
}

export async function startSolicitationReview(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    id: z.string().uuid('ID inválido'),
  });
  const { id } = paramsSchema.parse(request.params);
  const service = new SolicitationService();
  const solicitation = await service.startReview(id, request.user.sub);
  return reply.status(200).send({ solicitation });
}

export async function updateSolicitationReview(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    id: z.string().uuid('ID inválido'),
  });
  const bodySchema = z.object({
    client: z.enum($Enums.SolicitationClient).nullable(),
    activityType: z.enum($Enums.SolicitationActivityType).nullable(),
    productType: z.enum($Enums.SolicitationProductType).nullable(),
    priority: z.enum($Enums.SolicitationPriority).nullable(),
    approve: z.boolean().optional(),
  });
  const { id } = paramsSchema.parse(request.params);
  const body = bodySchema.parse(request.body);
  const service = new SolicitationService();
  const solicitation = await service.updateReview(
    id,
    {
      client: body.client,
      activityType: body.activityType,
      productType: body.productType,
      priority: body.priority,
      ...(body.approve !== undefined ? { approve: body.approve } : {}),
    },
    request.user.sub,
  );
  return reply.status(200).send({ solicitation });
}

export async function updateSolicitationStatus(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    id: z.string().uuid('ID inválido'),
  });
  const bodySchema = z.object({
    status: z.enum($Enums.SolicitationStatus),
  });
  const { id } = paramsSchema.parse(request.params);
  const { status } = bodySchema.parse(request.body);
  const service = new SolicitationService();
  const solicitation = await service.updateStatus(
    id,
    status,
    request.user.sub,
  );
  return reply.status(200).send({ solicitation });
}

export async function sendSolicitationToKairo(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    id: z.string().uuid('ID inválido'),
  });
  const bodySchema = z.object({
    teamId: z.string().min(1, 'Time é obrigatório'),
    kind: z.enum($Enums.SolicitationKind),
    title: z.string().trim().min(1, 'Título é obrigatório'),
    description: z.string().trim().min(1, 'Descrição é obrigatória'),
    tagId: z.string().min(1).optional(),
    estimatedHours: z.coerce
      .number()
      .positive('Horas estimadas deve ser um valor positivo')
      .optional(),
  });
  const { id } = paramsSchema.parse(request.params);
  const body = bodySchema.parse(request.body);
  const service = new SolicitationService();
  const solicitation = await service.sendToKairo(
    id,
    {
      teamId: body.teamId,
      kind: body.kind,
      title: body.title,
      description: body.description,
      ...(body.tagId ? { tagId: body.tagId } : {}),
      ...(body.estimatedHours !== undefined
        ? { estimatedHours: body.estimatedHours }
        : {}),
    },
    request.user.sub,
  );
  return reply.status(200).send({ solicitation });
}

export async function syncSolicitationFromKairo(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    id: z.string().uuid('ID inválido'),
  });
  const { id } = paramsSchema.parse(request.params);
  const service = new SolicitationService();
  const solicitation = await service.syncFromKairo(id, request.user.sub);
  return reply.status(200).send({ solicitation });
}

export async function syncPendingSolicitationsFromKairo(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  const service = new SolicitationService();
  const result = await service.syncPendingFromKairo();
  return reply.status(200).send(result);
}