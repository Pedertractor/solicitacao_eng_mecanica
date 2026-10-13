import { HttpError } from '../https/errors/index.js';
import { prisma } from '../lib/prisma.js';
import { $Enums } from '../generated/prisma/client.js';
import {
  type AccessActor,
  canAccessSolicitation,
  canManageSolicitations,
  isSuperAdmin,
  solicitationScope,
} from '../auth/access-policy.js';
import { ApiPedertractorEmployee } from '../integrations/api-pedertractor-employee.js';
import { ApiPedertractorPart } from '../integrations/api-pedertractor-part.js';
import { ApiPedertractorSector } from '../integrations/api-pedertractor-sector.js';
import {
  KAIRO_INTEGRATION_SOURCE,
  KairoClient,
} from '../integrations/kairo-client.js';
import {
  notifySolicitationApproved,
  notifySolicitationCompleted,
} from '../lib/solicitation-mail.js';
import { SolicitationPrismaRepository } from '../repositories/prisma/solicitation-repository.js';
import { KairoCredentialService } from './kairo-credential-service.js';
import {
  buildStoredDeadline,
  deliveryDateError,
  isComercialWorkflow,
  isValidProcessCombination,
  optionalHttpsUrl,
  parseIsoDate,
  processInstructionTitle,
  shouldShowDeliveryDate,
} from '../lib/process-instruction.js';
import {
  mapWorkflow,
  WorkflowService,
} from './workflow-service.js';
import { WorkflowStagePrismaRepository } from '../repositories/prisma/workflow-stage-repository.js';
import type { SolicitationWithWorkflow } from '../repositories/prisma/solicitation-repository.js';

function mapSolicitation(row: SolicitationWithWorkflow | {
  id: string;
  trackingCode: string;
  employeeId: string;
  requesterName: string;
  requesterEmail: string | null;
  cardNumber: string;
  unit: $Enums.Unit;
  costCenter: string;
  sectorId: string;
  sectorName: string;
  pillarOrLocation: string;
  title: string;
  description: string;
  processInstructionRequester: string | null;
  processInstructionProcess: string | null;
  processInstructionType: string | null;
  processInstructionDeadlineLabel: string | null;
  processInstructionDeadlineDate: string | null;
  deliveryDate: Date | null;
  partNumbers: string | null;
  fileLink: string | null;
  kind: $Enums.SolicitationKind | null;
  client: $Enums.SolicitationClient | null;
  activityType: $Enums.SolicitationActivityType | null;
  productType: $Enums.SolicitationProductType | null;
  priority: $Enums.SolicitationPriority | null;
  status: $Enums.SolicitationStatus;
  statusUpdatedAt: Date | null;
  statusUpdatedByUserId: string | null;
  kairoCardId: string | null;
  kairoCardIds: string | null;
  kairoTeamId: string | null;
  kairoSyncedAt: Date | null;
  kairoSyncedByUserId: string | null;
  deletedAt: Date | null;
  deletedByUserId: string | null;
  deletedByName: string | null;
  deletedFrom: $Enums.SolicitationDeletionSource | null;
  department: $Enums.UserDepartment;
  requiresTooling?: boolean;
  workflowStages?: SolicitationWithWorkflow['workflowStages'];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    trackingCode: row.trackingCode,
    employeeId: row.employeeId,
    requesterName: row.requesterName,
    requesterEmail: row.requesterEmail,
    cardNumber: row.cardNumber,
    unit: row.unit,
    costCenter: row.costCenter,
    sectorId: row.sectorId,
    sectorName: row.sectorName,
    pillarOrLocation: row.pillarOrLocation,
    title: row.title,
    description: row.description,
    processInstructionRequester: row.processInstructionRequester,
    processInstructionProcess: row.processInstructionProcess,
    processInstructionType: row.processInstructionType,
    processInstructionDeadlineLabel: row.processInstructionDeadlineLabel,
    processInstructionDeadlineDate: row.processInstructionDeadlineDate,
    deliveryDate: toDateOnly(row.deliveryDate),
    partNumbers: row.partNumbers,
    fileLink: row.fileLink,
    kind: row.kind,
    client: row.client,
    activityType: row.activityType,
    productType: row.productType,
    priority: row.priority,
    status: row.status,
    statusUpdatedAt: row.statusUpdatedAt?.toISOString() ?? null,
    statusUpdatedByUserId: row.statusUpdatedByUserId,
    kairoCardId: row.kairoCardId,
    kairoCardIds: row.kairoCardIds,
    kairoTeamId: row.kairoTeamId,
    kairoSyncedAt: row.kairoSyncedAt?.toISOString() ?? null,
    kairoSyncedByUserId: row.kairoSyncedByUserId,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    deletedByUserId: row.deletedByUserId,
    deletedByName: row.deletedByName,
    deletedFrom: row.deletedFrom,
    department: row.department,
    requiresTooling: row.requiresTooling ?? false,
    workflow: mapWorkflow({
      requiresTooling: row.requiresTooling ?? false,
      ...(row.workflowStages ? { workflowStages: row.workflowStages } : {}),
    }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function splitCommaList(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function listLinkedKairoCardIds(row: {
  kairoCardId: string | null;
  kairoCardIds?: string | null;
}): string[] {
  const listed = splitCommaList(row.kairoCardIds);
  if (listed.length > 0) return listed;
  return row.kairoCardId ? [row.kairoCardId] : [];
}

function appendPartNumber(description: string, partNumber: string): string {
  return `${description.trim()}\nPart number: ${partNumber}`;
}

function buildProcessInstructionContent(input: {
  processInstructionRequester: string;
  processInstructionProcess: string;
  processInstructionType: string;
  client: $Enums.SolicitationClient;
  deliveryDate?: string | undefined;
  partNumbers?: string | undefined;
  fileLink?: string | undefined;
  comments?: string | undefined;
}) {
  const requester = input.processInstructionRequester.trim();
  const process = input.processInstructionProcess.trim();
  const type = input.processInstructionType.trim();

  if (!isValidProcessCombination(requester, process, type)) {
    throw new HttpError(
      'Combinação de solicitante, processo e tipo inválida',
      400,
    );
  }

  const deliveryIso = input.deliveryDate?.trim() ?? '';
  const dateError = deliveryDateError(requester, process, type, deliveryIso);
  if (dateError) {
    throw new HttpError(dateError, 400);
  }

  let fileLink: string | null;
  try {
    fileLink = optionalHttpsUrl(input.fileLink ?? '');
  } catch (error) {
    throw new HttpError(
      error instanceof Error ? error.message : 'Link de arquivos inválido.',
      400,
    );
  }

  const storedDelivery = shouldShowDeliveryDate(requester, process, type)
    ? deliveryIso
    : null;
  const deadline = buildStoredDeadline(
    requester,
    process,
    type,
    storedDelivery,
  );

  return {
    title: processInstructionTitle(process, type),
    description: input.comments?.trim() ?? '',
    client: input.client,
    processInstructionRequester: requester,
    processInstructionProcess: process,
    processInstructionType: type,
    processInstructionDeadlineLabel: deadline.deadlineLabel,
    processInstructionDeadlineDate: deadline.deadlineDate,
    deliveryDate: storedDelivery ? isoDateToUtc(storedDelivery) : null,
    partNumbers: input.partNumbers?.trim() || null,
    fileLink,
  };
}

function toDateOnly(value: Date | null): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function isoDateToUtc(value: string): Date {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    throw new HttpError('Data de entrega inválida.', 400);
  }
  return new Date(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()),
  );
}

function mapPublicTicket(row: {
  trackingCode: string;
  requesterName: string;
  unit: $Enums.Unit;
  sectorName: string;
  pillarOrLocation: string;
  title: string;
  description: string;
  department: $Enums.UserDepartment;
  client: $Enums.SolicitationClient | null;
  processInstructionRequester: string | null;
  processInstructionProcess: string | null;
  processInstructionType: string | null;
  processInstructionDeadlineLabel: string | null;
  processInstructionDeadlineDate: string | null;
  deliveryDate: Date | null;
  partNumbers: string | null;
  fileLink: string | null;
  status: $Enums.SolicitationStatus;
  statusUpdatedAt: Date | null;
  createdAt: Date;
  requiresTooling?: boolean;
  workflowStages?: SolicitationWithWorkflow['workflowStages'];
}) {
  return {
    trackingCode: row.trackingCode,
    status: row.status,
    title: row.title,
    description: row.description,
    requesterName: row.requesterName,
    sectorName: row.sectorName,
    pillarOrLocation: row.pillarOrLocation,
    unit: row.unit,
    department: row.department,
    client: row.client,
    processInstructionRequester: row.processInstructionRequester,
    processInstructionProcess: row.processInstructionProcess,
    processInstructionType: row.processInstructionType,
    processInstructionDeadlineLabel: row.processInstructionDeadlineLabel,
    processInstructionDeadlineDate: row.processInstructionDeadlineDate,
    deliveryDate: toDateOnly(row.deliveryDate),
    partNumbers: row.partNumbers,
    fileLink: row.fileLink,
    createdAt: row.createdAt.toISOString(),
    statusUpdatedAt: row.statusUpdatedAt?.toISOString() ?? null,
    workflow: mapWorkflow({
      requiresTooling: row.requiresTooling ?? false,
      ...(row.workflowStages ? { workflowStages: row.workflowStages } : {}),
    }),
  };
}

export class SolicitationService {
  async validateRequester(cardNumber: string, unit: $Enums.Unit) {
    const api = new ApiPedertractorEmployee();
    const employee = await api.getEmployee({ cardNumber, unit });

    if (!employee.status) {
      throw new HttpError(
        'Colaborador não está ativo no diretório corporativo',
        400,
      );
    }

    const repo = new SolicitationPrismaRepository(prisma);
    const email = await repo.findLatestRequesterEmail(
      employee.cardNumber,
      employee.unit as $Enums.Unit,
    );

    return {
      employeeId: String(employee.id),
      name: employee.name,
      status: employee.status,
      cardNumber: employee.cardNumber,
      unit: employee.unit as $Enums.Unit,
      email,
    };
  }

  async lookupPartByNumber(partNumber: string) {
    const api = new ApiPedertractorPart();
    return api.getByPartNumber(partNumber);
  }

  async resolvePartNumbers(raw: string | undefined): Promise<string | null> {
    const tokens = (raw ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (tokens.length === 0) return null;

    const confirmed: string[] = [];
    const seen = new Set<string>();
    for (const token of tokens) {
      const part = await this.lookupPartByNumber(token);
      const key = part.partNumber.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      confirmed.push(part.partNumber);
    }
    return confirmed.join(', ');
  }

  async getSectorByCostCenter(costCenter: string) {
    const trimmed = costCenter.trim();
    if (!trimmed) {
      throw new HttpError('Centro de custo é obrigatório', 400);
    }

    const api = new ApiPedertractorSector();
    const sector = await api.getSectorByCostCenter(trimmed);

    if (sector.status === false) {
      throw new HttpError('Setor inativo', 400);
    }

    return {
      id: sector.id,
      name: sector.name,
      costCenter: sector.costCenter,
      normalizedName: sector.normalizedName,
      status: sector.status,
    };
  }

  async create(
    input: {
      cardNumber: string;
      unit: $Enums.Unit;
      costCenter: string;
      pillarOrLocation: string;
      requesterEmail: string;
    } & (
      | {
          department: 'ENG_MECANICA';
          title: string;
          description: string;
        }
      | {
          department: 'DESENVOLVIMENTO_PROCESSOS';
          processInstructionRequester: string;
          processInstructionProcess: string;
          processInstructionType: string;
          client: $Enums.SolicitationClient;
          deliveryDate?: string | undefined;
          partNumbers?: string | undefined;
          fileLink?: string | undefined;
          comments?: string | undefined;
          requiresTooling?: boolean | undefined;
        }
    ),
  ) {
    const requester = await this.validateRequester(
      input.cardNumber,
      input.unit,
    );
    const sector = await this.getSectorByCostCenter(input.costCenter);
    const requesterEmail = input.requesterEmail.trim().toLowerCase();
    const content =
      input.department === 'DESENVOLVIMENTO_PROCESSOS'
        ? {
            ...buildProcessInstructionContent(input),
            partNumbers: await this.resolvePartNumbers(input.partNumbers),
          }
        : {
            title: input.title.trim(),
            description: input.description.trim(),
          };

    const shouldCreateWorkflow =
      input.department === 'DESENVOLVIMENTO_PROCESSOS' &&
      isComercialWorkflow(
        input.department,
        input.processInstructionRequester,
      );
    const requiresTooling =
      shouldCreateWorkflow && Boolean(input.requiresTooling);

    const created = await prisma.$transaction(async (tx) => {
      const repo = new SolicitationPrismaRepository(tx);
      const solicitation = await repo.create({
        employeeId: requester.employeeId,
        requesterName: requester.name,
        requesterEmail,
        cardNumber: requester.cardNumber,
        unit: requester.unit,
        costCenter: sector.costCenter,
        sectorId: sector.id,
        sectorName: sector.name,
        pillarOrLocation: input.pillarOrLocation.trim(),
        department: input.department,
        requiresTooling,
        ...content,
      });

      if (shouldCreateWorkflow && input.department === 'DESENVOLVIMENTO_PROCESSOS') {
        const workflowService = new WorkflowService();
        const deliveryIso =
          'deliveryDate' in content && content.deliveryDate
            ? toDateOnly(content.deliveryDate)
            : input.deliveryDate?.trim() || null;
        const stages = workflowService.buildStagesForCreate({
          requester: input.processInstructionRequester,
          process: input.processInstructionProcess,
          type: input.processInstructionType,
          deliveryDateIso: deliveryIso,
          requiresTooling,
        });
        const workflowRepo = new WorkflowStagePrismaRepository(tx);
        const workflowStages = await workflowRepo.createStages(
          solicitation.id,
          stages,
        );
        return { ...solicitation, workflowStages };
      }

      return solicitation;
    });

    return mapSolicitation(created);
  }

  async list(input: {
    status?: $Enums.SolicitationStatus;
    page: number;
    pageSize: number;
    sortBy?:
      | 'createdAt'
      | 'requesterName'
      | 'sectorName'
      | 'title'
      | 'status';
    sortOrder?: 'asc' | 'desc';
    onlyWorkflow?: boolean;
  },
    actor: AccessActor,
  ) {
    const repo = new SolicitationPrismaRepository(prisma);
    const { items, total } = await repo.findManyPaginated({
      ...input,
      scope: solicitationScope(actor),
    });
    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));

    return {
      solicitations: items.map(mapSolicitation),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages,
      },
    };
  }

  async getById(id: string, actor: AccessActor) {
    await this.assertAccessible(id, actor, false);
    const repo = new SolicitationPrismaRepository(prisma);
    const row = await repo.findById(id);
    if (!row) {
      throw new HttpError('Solicitação não encontrada', 404);
    }
    return mapSolicitation(row);
  }

  async getByTrackingCode(trackingCode: string) {
    const code = trackingCode.trim().toUpperCase();
    if (!code) {
      throw new HttpError('Código de acompanhamento inválido', 400);
    }

    const repo = new SolicitationPrismaRepository(prisma);
    const row = await repo.findByTrackingCode(code);
    if (!row) {
      throw new HttpError('Solicitação não encontrada', 404);
    }
    return mapPublicTicket(row);
  }

  async startReview(id: string, actingUserId: string) {
    await this.assertAccessible(
      id,
      await this.loadActor(actingUserId),
      true,
    );
    const repo = new SolicitationPrismaRepository(prisma);
    const existing = await repo.findById(id);
    if (!existing) {
      throw new HttpError('Solicitação não encontrada', 404);
    }

    if (existing.status !== $Enums.SolicitationStatus.PENDING) {
      return mapSolicitation(existing);
    }

    const updated = await repo.updateStatus(
      id,
      $Enums.SolicitationStatus.IN_REVIEW,
      actingUserId,
    );
    return mapSolicitation(updated);
  }

  async updateReview(
    id: string,
    input: {
      client?: $Enums.SolicitationClient | null;
      activityType?: $Enums.SolicitationActivityType | null;
      productType?: $Enums.SolicitationProductType | null;
      priority?: $Enums.SolicitationPriority | null;
      approve?: boolean;
    },
    actingUserId: string,
  ) {
    await this.assertAccessible(id, await this.loadActor(actingUserId), true);
    const repo = new SolicitationPrismaRepository(prisma);
    const existing = await repo.findById(id);
    if (!existing) {
      throw new HttpError('Solicitação não encontrada', 404);
    }

    const review = {
      client: input.client !== undefined ? input.client : existing.client,
      activityType:
        input.activityType !== undefined
          ? input.activityType
          : existing.activityType,
      productType:
        input.productType !== undefined
          ? input.productType
          : existing.productType,
      priority:
        input.priority !== undefined ? input.priority : existing.priority,
    };

    if (input.approve) {
      const wasAlreadyApproved =
        existing.status === $Enums.SolicitationStatus.APPROVED;

      const updated = await repo.updateReview(id, {
        ...review,
        status: $Enums.SolicitationStatus.APPROVED,
        statusUpdatedByUserId: actingUserId,
      });

      if (!wasAlreadyApproved) {
        await notifySolicitationApproved(updated);
      }

      return mapSolicitation(updated);
    }

    const updated = await repo.updateReview(id, review);
    return mapSolicitation(updated);
  }

  async updateStatus(
    id: string,
    status: $Enums.SolicitationStatus,
    actingUserId: string,
  ) {
    await this.assertAccessible(id, await this.loadActor(actingUserId), true);
    const repo = new SolicitationPrismaRepository(prisma);
    const existing = await repo.findById(id);
    if (!existing) {
      throw new HttpError('Solicitação não encontrada', 404);
    }

    if (status === $Enums.SolicitationStatus.DELETED) {
      throw new HttpError(
        'Use a exclusão da solicitação para marcar como excluída',
        400,
      );
    }

    if (existing.status === $Enums.SolicitationStatus.DELETED) {
      throw new HttpError('Solicitação excluída não pode mudar de status', 400);
    }

    const previousStatus = existing.status;
    const updated = await repo.updateStatus(id, status, actingUserId);

    if (
      status === $Enums.SolicitationStatus.CANCELLED &&
      previousStatus !== $Enums.SolicitationStatus.CANCELLED
    ) {
      await new WorkflowService().cancelOpenStages(id);
    }

    if (
      status === $Enums.SolicitationStatus.APPROVED &&
      previousStatus !== $Enums.SolicitationStatus.APPROVED
    ) {
      await notifySolicitationApproved(updated);
    }

    if (
      status === $Enums.SolicitationStatus.COMPLETED &&
      previousStatus !== $Enums.SolicitationStatus.COMPLETED
    ) {
      await notifySolicitationCompleted(updated);
    }

    return mapSolicitation(updated);
  }

  async delete(id: string, actingUserId: string) {
    await this.assertAccessible(id, await this.loadActor(actingUserId), true);
    const repo = new SolicitationPrismaRepository(prisma);
    const existing = await repo.findById(id);
    if (!existing) {
      throw new HttpError('Solicitação não encontrada', 404);
    }

    if (
      existing.status === $Enums.SolicitationStatus.DELETED ||
      existing.deletedAt
    ) {
      throw new HttpError('Solicitação já está excluída', 400);
    }

    const actor = await prisma.user.findUnique({
      where: { id: actingUserId },
      select: { id: true, name: true },
    });
    if (!actor) {
      throw new HttpError('Usuário não encontrado', 404);
    }

    // Tenta remover no Kairo, mas nunca bloqueia o soft-delete local
    // (falha de rede/502/credencial ausente não deve impedir a exclusão).
    const linkedCardIds = listLinkedKairoCardIds(existing);
    if (linkedCardIds.length > 0 && existing.kairoTeamId) {
      const credentials = new KairoCredentialService();
      const client = await credentials.tryGetClientForUser(actingUserId);

      if (client) {
        let deletedAny = false;
        for (const cardId of linkedCardIds) {
          try {
            await this.deleteKairoCard(
              client,
              existing.kairoTeamId,
              cardId,
              existing.kind,
            );
            deletedAny = true;
          } catch (error) {
            if (
              !(error instanceof HttpError && error.statusCode === 404)
            ) {
              console.error(
                '[solicitation.delete] Falha ao excluir card no Kairo; seguindo com soft-delete local',
                error,
              );
            }
          }
        }
        if (deletedAny) {
          await credentials.touchValidated(actingUserId);
        }
      }
    }

    await new WorkflowService().cancelOpenStages(id);

    const updated = await repo.markDeleted(id, {
      deletedByUserId: actor.id,
      deletedByName: actor.name,
      deletedFrom: $Enums.SolicitationDeletionSource.SOLICITATION_APP,
    });

    return mapSolicitation(updated);
  }

  async sendToKairo(
    id: string,
    input: {
      teamId: string;
      kind: $Enums.SolicitationKind;
      title: string;
      description: string;
      tagId?: string;
      estimatedHours?: number;
    },
    actingUserId: string,
  ) {
    await this.assertAccessible(id, await this.loadActor(actingUserId), true);
    const repo = new SolicitationPrismaRepository(prisma);
    const existing = await repo.findById(id);
    if (!existing) {
      throw new HttpError('Solicitação não encontrada', 404);
    }

    if (existing.status !== $Enums.SolicitationStatus.APPROVED) {
      throw new HttpError(
        'A solicitação precisa estar aprovada para enviar ao Kairo',
        400,
      );
    }

    if (listLinkedKairoCardIds(existing).length > 0) {
      throw new HttpError('Esta solicitação já foi enviada ao Kairo', 400);
    }

    const partNumbers =
      existing.department === $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS
        ? splitCommaList(existing.partNumbers)
        : [];
    const sendOneActivityPerPart = partNumbers.length > 0;

    const trimmedTagId = input.tagId?.trim() || undefined;

    if (sendOneActivityPerPart && input.kind !== $Enums.SolicitationKind.ATIVIDADE) {
      throw new HttpError(
        'Solicitações de processo com part number são enviadas como atividade',
        400,
      );
    }

    const credentials = new KairoCredentialService();
    const client = await credentials.getClientForUser(actingUserId);

    let cardIds: string[];
    let kind = input.kind;

    if (sendOneActivityPerPart) {
      const instructionType = existing.processInstructionType?.trim();
      if (!instructionType) {
        throw new HttpError(
          'A solicitação de processo não tem tipo para nomear as atividades',
          400,
        );
      }

      kind = $Enums.SolicitationKind.ATIVIDADE;
      cardIds = [];
      try {
        for (const partNumber of partNumbers) {
          const { activity } = await client.createActivity(input.teamId, {
            title: `${partNumber} — ${instructionType}`,
            description: appendPartNumber(input.description, partNumber),
            integrationSource: KAIRO_INTEGRATION_SOURCE,
            ...(trimmedTagId ? { tagId: trimmedTagId } : {}),
          });
          cardIds.push(activity.id);
        }
      } catch (error) {
        await this.rollbackCreatedActivities(client, input.teamId, cardIds);
        throw error;
      }
    } else if (input.kind === $Enums.SolicitationKind.ATIVIDADE) {
      const { activity } = await client.createActivity(input.teamId, {
        title: input.title,
        description: input.description,
        integrationSource: KAIRO_INTEGRATION_SOURCE,
        ...(trimmedTagId ? { tagId: trimmedTagId } : {}),
      });
      cardIds = [activity.id];
    } else {
      const { project } = await client.createProject(input.teamId, {
        title: input.title,
        description: input.description,
        integrationSource: KAIRO_INTEGRATION_SOURCE,
        ...(input.estimatedHours !== undefined
          ? { estimatedHours: input.estimatedHours }
          : {}),
      });
      cardIds = [project.id];
    }

    await credentials.touchValidated(actingUserId);

    const updated = await repo.markKairoSynced(id, {
      kairoCardId: cardIds[0]!,
      kairoCardIds: cardIds.join(', '),
      kairoTeamId: input.teamId,
      kairoSyncedByUserId: actingUserId,
      kind,
    });

    return mapSolicitation(updated);
  }

  async syncFromKairo(id: string, actingUserId?: string) {
    if (actingUserId) {
      await this.assertAccessible(id, await this.loadActor(actingUserId), true);
    }
    const repo = new SolicitationPrismaRepository(prisma);
    const existing = await repo.findById(id);
    if (!existing) {
      throw new HttpError('Solicitação não encontrada', 404);
    }

    if (existing.status === $Enums.SolicitationStatus.COMPLETED) {
      return mapSolicitation(existing);
    }

    if (existing.status === $Enums.SolicitationStatus.CANCELLED) {
      return mapSolicitation(existing);
    }

    if (existing.status === $Enums.SolicitationStatus.DELETED) {
      return mapSolicitation(existing);
    }

    const linkedCardIds = listLinkedKairoCardIds(existing);
    if (linkedCardIds.length === 0 || !existing.kairoTeamId) {
      return mapSolicitation(existing);
    }

    const credentials = new KairoCredentialService();
    const candidateUserIds = [
      actingUserId,
      existing.kairoSyncedByUserId,
    ].filter((value): value is string => Boolean(value));

    let client = null as Awaited<
      ReturnType<KairoCredentialService['tryGetClientForUser']>
    >;
    let credentialUserId: string | null = null;

    for (const userId of candidateUserIds) {
      client = await credentials.tryGetClientForUser(userId);
      if (client) {
        credentialUserId = userId;
        break;
      }
    }

    if (!client || !credentialUserId) {
      if (actingUserId) {
        throw new HttpError(
          'Vincule sua chave de API do Kairo em Integrações antes de sincronizar',
          400,
        );
      }
      return mapSolicitation(existing);
    }

    const kairoCards: Array<{
      kind: $Enums.SolicitationKind;
      status: string | undefined;
      deletedAt: string | null;
      deletedByName: string | null;
      startedAt?: string | null;
      finishedAt?: string | null;
      updatedAt?: string | null;
    }> = [];
    for (const cardId of linkedCardIds) {
      const kairoCard = await this.fetchKairoCardStatus(
        client,
        existing.kairoTeamId,
        cardId,
        existing.kind,
      );
      if (!kairoCard) {
        return mapSolicitation(existing);
      }
      kairoCards.push(kairoCard);
    }

    const sharedKind = kairoCards.every(
      (card) => card.kind === kairoCards[0]!.kind,
    )
      ? kairoCards[0]!.kind
      : null;
    if (sharedKind && existing.kind !== sharedKind) {
      await repo.updateKind(id, sharedKind);
    }

    await credentials.touchValidated(credentialUserId);

    if (kairoCards.every((card) => card.deletedAt)) {
      const deletedByName =
        kairoCards
          .map((card) => card.deletedByName?.trim())
          .find((name): name is string => Boolean(name)) || 'Usuário do Kairo';
      await new WorkflowService().cancelOpenStages(id);
      const updated = await repo.markDeleted(id, {
        deletedByUserId: null,
        deletedByName,
        deletedFrom: $Enums.SolicitationDeletionSource.KAIRO,
      });
      return mapSolicitation(updated);
    }

    const hasWorkflow = (existing.workflowStages?.length ?? 0) > 0;
    if (hasWorkflow) {
      const workflowUpdated = await new WorkflowService().applyEngineeringKairoState(
        existing,
        kairoCards,
      );
      return mapSolicitation(workflowUpdated);
    }

    if (!kairoCards.every((card) => card.status === 'DONE' && !card.deletedAt)) {
      return mapSolicitation(existing);
    }

    const updated = await repo.updateStatus(
      id,
      $Enums.SolicitationStatus.COMPLETED,
      credentialUserId,
    );

    await notifySolicitationCompleted(updated);

    return mapSolicitation(updated);
  }

  async syncPendingFromKairo(actor?: AccessActor) {
    if (actor && !canManageSolicitations(actor)) {
      throw new HttpError('Sem permissão para alterar esta solicitação', 403);
    }
    const repo = new SolicitationPrismaRepository(prisma);
    const pending = await repo.findPendingKairoSync(
      actor && !isSuperAdmin(actor.role) ? actor.department : undefined,
    );
    let completed = 0;
    let deleted = 0;

    for (const row of pending) {
      try {
        const synced = await this.syncFromKairo(row.id);
        if (synced.status === $Enums.SolicitationStatus.COMPLETED) {
          completed += 1;
        } else if (synced.status === $Enums.SolicitationStatus.DELETED) {
          deleted += 1;
        }
      } catch (error) {
        console.error(
          `[kairo-sync] Falha ao sincronizar solicitação ${row.id}:`,
          error,
        );
      }
    }

    return { checked: pending.length, completed, deleted };
  }

  private async loadActor(userId: string): Promise<AccessActor> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        department: true,
        cardNumber: true,
        unit: true,
      },
    });
    if (!user) {
      throw new HttpError('Não autorizado', 401);
    }
    return user;
  }

  private async assertAccessible(
    id: string,
    actor: AccessActor,
    manage: boolean,
  ) {
    const repo = new SolicitationPrismaRepository(prisma);
    const row = await repo.findById(id);
    if (!row || !canAccessSolicitation(actor, row)) {
      throw new HttpError('Solicitação não encontrada', 404);
    }
    if (manage && !canManageSolicitations(actor)) {
      throw new HttpError('Sem permissão para alterar esta solicitação', 403);
    }
  }

  private async resolveKairoKind(
    client: KairoClient,
    teamId: string,
    cardId: string,
  ): Promise<$Enums.SolicitationKind | null> {
    try {
      await client.getActivity(teamId, cardId);
      return $Enums.SolicitationKind.ATIVIDADE;
    } catch {
      try {
        await client.getProject(teamId, cardId);
        return $Enums.SolicitationKind.PROJETO;
      } catch {
        return null;
      }
    }
  }

  private async fetchKairoCardStatus(
    client: KairoClient,
    teamId: string,
    cardId: string,
    preferredKind?: $Enums.SolicitationKind | null,
  ): Promise<{
    kind: $Enums.SolicitationKind;
    status: string | undefined;
    deletedAt: string | null;
    deletedByName: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
    updatedAt?: string | null;
  } | null> {
    const fetchByKind = async (kind: $Enums.SolicitationKind) => {
      if (kind === $Enums.SolicitationKind.ATIVIDADE) {
        const { activity } = await client.getActivity(teamId, cardId);
        return {
          kind,
          status: activity.status,
          deletedAt: activity.deletedAt ?? null,
          deletedByName: activity.deletedByName ?? null,
          startedAt: activity.startedAt ?? null,
          finishedAt: activity.finishedAt ?? null,
          updatedAt: activity.updatedAt ?? null,
        };
      }

      const { project } = await client.getProject(teamId, cardId);
      return {
        kind,
        status: project.status,
        deletedAt: project.deletedAt ?? null,
        deletedByName: project.deletedByName ?? null,
      };
    };

    if (preferredKind) {
      try {
        return await fetchByKind(preferredKind);
      } catch (error) {
        if (!(error instanceof HttpError && error.statusCode === 404)) {
          throw error;
        }
      }
    }

    const resolvedKind = await this.resolveKairoKind(client, teamId, cardId);
    if (!resolvedKind) {
      return null;
    }

    return fetchByKind(resolvedKind);
  }

  private async deleteKairoCard(
    client: KairoClient,
    teamId: string,
    cardId: string,
    kind: $Enums.SolicitationKind | null,
  ) {
    if (kind === $Enums.SolicitationKind.PROJETO) {
      await client.deleteProject(teamId, cardId);
      return;
    }

    if (kind === $Enums.SolicitationKind.ATIVIDADE) {
      await client.deleteActivity(teamId, cardId);
      return;
    }

    try {
      await client.deleteActivity(teamId, cardId);
    } catch (activityError) {
      if (
        !(
          activityError instanceof HttpError &&
          activityError.statusCode === 404
        )
      ) {
        throw activityError;
      }
      await client.deleteProject(teamId, cardId);
    }
  }

  private async rollbackCreatedActivities(
    client: KairoClient,
    teamId: string,
    activityIds: string[],
  ) {
    for (const activityId of activityIds) {
      try {
        await client.deleteActivity(teamId, activityId);
      } catch (error) {
        console.error(
          '[solicitation.sendToKairo] Falha ao desfazer atividade criada no Kairo',
          error,
        );
      }
    }
  }
}

