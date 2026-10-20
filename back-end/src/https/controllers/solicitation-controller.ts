import z from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { actorFromSession } from '../../auth/access-policy.js';
import { $Enums } from '../../generated/prisma/client.js';
import { HttpError } from '../errors/index.js';
import { SolicitationService } from '../../services/solicitation-service.js';
import { WorkflowService } from '../../services/workflow-service.js';

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

export async function getPartByNumber(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    partNumber: z.string().min(1, 'Part number é obrigatório'),
  });
  const { partNumber } = paramsSchema.parse(request.params);
  const service = new SolicitationService();
  const part = await service.lookupPartByNumber(partNumber);
  return reply.status(200).send({ part });
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
  const shared = {
    cardNumber: z.string().min(1, 'Cartão é obrigatório'),
    unit: z.enum($Enums.Unit),
    costCenter: z.string().min(1, 'Centro de custo é obrigatório'),
    pillarOrLocation: z.string().min(1, 'Pilar/local é obrigatório'),
    requesterEmail: z.email('E-mail inválido'),
  };
  const bodySchema = z.discriminatedUnion('department', [
    z.object({
      ...shared,
      department: z.literal($Enums.UserDepartment.ENG_MECANICA),
      title: z.string().min(1, 'Título é obrigatório'),
      description: z.string().min(1, 'Descrição é obrigatória'),
    }),
    z.object({
      ...shared,
      department: z.literal($Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS),
      processInstructionRequester: z
        .string()
        .min(1, 'Solicitante é obrigatório'),
      processInstructionProcess: z.string().min(1, 'Processo é obrigatório'),
      processInstructionType: z.string().min(1, 'Tipo é obrigatório'),
      client: z.enum($Enums.SolicitationClient),
      deliveryDate: z.string().optional(),
      partNumbers: z.string().optional(),
      fileLink: z.string().optional(),
      comments: z.string().optional(),
      requiresTooling: z.boolean().optional(),
    }),
  ]);
  const body = bodySchema.parse(request.body);
  const service = new SolicitationService();
  const solicitation = await service.create(body);
  return reply.status(201).send({ solicitation });
}

const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');

/** Limites do dia civil em America/Sao_Paulo (UTC-3, sem horário de verão). */
function saoPauloDayBound(date: string, bound: 'start' | 'end'): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new HttpError('Data inválida', 400);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  const isRealDay =
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day;
  if (!isRealDay) {
    throw new HttpError('Data inválida', 400);
  }
  const time =
    bound === 'start' ? 'T00:00:00.000-03:00' : 'T23:59:59.999-03:00';
  return new Date(`${date}${time}`);
}

export async function listSolicitations(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const querySchema = z
    .object({
      status: z.enum($Enums.SolicitationStatus).optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(10),
      sortBy: z
        .enum(['createdAt', 'requesterName', 'sectorName', 'title', 'status'])
        .default('createdAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
      onlyWorkflow: z
        .enum(['true', 'false', '1', '0'])
        .optional()
        .transform((value) => value === 'true' || value === '1'),
      createdFrom: calendarDateSchema.optional(),
      createdTo: calendarDateSchema.optional(),
      q: z
        .string()
        .trim()
        .max(120, 'A busca pode ter no máximo 120 caracteres')
        .optional()
        .transform((value) => (value ? value : undefined)),
    })
    .refine(
      (value) =>
        !value.createdFrom ||
        !value.createdTo ||
        value.createdFrom <= value.createdTo,
      { message: 'A data inicial não pode ser maior que a data final.' },
    );
  const query = querySchema.parse(request.query);
  const service = new SolicitationService();
  const result = await service.list({
    page: query.page,
    pageSize: query.pageSize,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.onlyWorkflow ? { onlyWorkflow: true } : {}),
    ...(query.createdFrom
      ? { createdFrom: saoPauloDayBound(query.createdFrom, 'start') }
      : {}),
    ...(query.createdTo
      ? { createdTo: saoPauloDayBound(query.createdTo, 'end') }
      : {}),
    ...(query.q ? { search: query.q } : {}),
  }, actorFromSession(request.user));
  return reply.status(200).send(result);
}

export async function getProcessCharts(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const querySchema = z.object({
    teamId: z.string().min(1, 'Time é obrigatório'),
    period: z.enum(['year', 'month', 'week']).default('month'),
  });
  const query = querySchema.parse(request.query);
  const service = new SolicitationService();
  const charts = await service.getProcessCharts(actorFromSession(request.user), {
    teamId: query.teamId,
    period: query.period,
  });
  return reply.status(200).send(charts);
}

export async function getWorkflowSummary(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const service = new WorkflowService();
  const summary = await service.summary(actorFromSession(request.user));
  return reply.status(200).send(summary);
}

export async function getEngineeringQueue(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const service = new SolicitationService();
  const result = await service.listEngineeringQueue(
    actorFromSession(request.user),
  );
  return reply.status(200).send(result);
}

export async function sendToolingToKairo(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    id: z.string().uuid('ID inválido'),
  });
  const bodySchema = z.object({
    teamId: z.string().min(1, 'Time é obrigatório'),
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
    tagId: z.string().min(1).optional(),
  });
  const { id } = paramsSchema.parse(request.params);
  const body = bodySchema.parse(request.body);
  const service = new WorkflowService();
  const row = await service.sendToolingToKairo(
    id,
    {
      teamId: body.teamId,
      ...(body.title ? { title: body.title } : {}),
      ...(body.description ? { description: body.description } : {}),
      ...(body.tagId ? { tagId: body.tagId } : {}),
    },
    request.user.sub,
  );
  const solicitationService = new SolicitationService();
  const solicitation = await solicitationService.getById(
    row.id,
    actorFromSession(request.user),
  );
  return reply.status(200).send({ solicitation });
}

export async function syncToolingFromKairo(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    id: z.string().uuid('ID inválido'),
  });
  const { id } = paramsSchema.parse(request.params);
  const service = new WorkflowService();
  const row = await service.syncToolingFromKairo(id, request.user.sub);
  const solicitationService = new SolicitationService();
  const solicitation = await solicitationService.getById(
    row.id,
    actorFromSession(request.user),
  );
  return reply.status(200).send({ solicitation });
}

export async function sendSampleToKairo(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    id: z.string().uuid('ID inválido'),
  });
  const bodySchema = z.object({
    teamId: z.string().min(1, 'Time é obrigatório'),
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
    tagId: z.string().min(1).optional(),
  });
  const { id } = paramsSchema.parse(request.params);
  const body = bodySchema.parse(request.body);
  const service = new WorkflowService();
  const row = await service.sendSampleToKairo(
    id,
    {
      teamId: body.teamId,
      ...(body.title ? { title: body.title } : {}),
      ...(body.description ? { description: body.description } : {}),
      ...(body.tagId ? { tagId: body.tagId } : {}),
    },
    request.user.sub,
  );
  const solicitationService = new SolicitationService();
  const solicitation = await solicitationService.getById(
    row.id,
    actorFromSession(request.user),
  );
  return reply.status(200).send({ solicitation });
}

export async function syncSampleFromKairo(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    id: z.string().uuid('ID inválido'),
  });
  const { id } = paramsSchema.parse(request.params);
  const service = new WorkflowService();
  const row = await service.syncSampleFromKairo(id, request.user.sub);
  const solicitationService = new SolicitationService();
  const solicitation = await solicitationService.getById(
    row.id,
    actorFromSession(request.user),
  );
  return reply.status(200).send({ solicitation });
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
  const solicitation = await service.getById(id, actorFromSession(request.user));
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
    client: z.enum($Enums.SolicitationClient).nullable().optional(),
    activityType: z.enum($Enums.SolicitationActivityType).nullable().optional(),
    productType: z.enum($Enums.SolicitationProductType).nullable().optional(),
    priority: z.enum($Enums.SolicitationPriority).nullable().optional(),
    approve: z.boolean().optional(),
  });
  const { id } = paramsSchema.parse(request.params);
  const body = bodySchema.parse(request.body);
  const service = new SolicitationService();
  const solicitation = await service.updateReview(
    id,
    {
      ...(body.client !== undefined ? { client: body.client } : {}),
      ...(body.activityType !== undefined
        ? { activityType: body.activityType }
        : {}),
      ...(body.productType !== undefined
        ? { productType: body.productType }
        : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {}),
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

export async function updateSolicitationOf(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    id: z.string().uuid('ID inválido'),
  });
  const bodySchema = z.object({
    ofNumber: z.string().nullable(),
  });
  const { id } = paramsSchema.parse(request.params);
  const { ofNumber } = bodySchema.parse(request.body);
  const service = new SolicitationService();
  const solicitation = await service.updateOfNumber(
    id,
    ofNumber,
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
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const service = new SolicitationService();
  const result = await service.syncPendingFromKairo(
    actorFromSession(request.user),
  );
  return reply.status(200).send(result);
}

export async function deleteSolicitation(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    id: z.string().uuid('ID inválido'),
  });
  const { id } = paramsSchema.parse(request.params);
  const service = new SolicitationService();
  const solicitation = await service.delete(id, request.user.sub);
  return reply.status(200).send({ solicitation });
}