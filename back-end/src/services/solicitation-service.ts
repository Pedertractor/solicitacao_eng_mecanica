import { HttpError } from '../https/errors/index.js';
import { prisma } from '../lib/prisma.js';
import { $Enums } from '../generated/prisma/client.js';
import { ApiPedertractorEmployee } from '../integrations/api-pedertractor-employee.js';
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

const OPEN_STATUSES: $Enums.SolicitationStatus[] = [
  $Enums.SolicitationStatus.PENDING,
  $Enums.SolicitationStatus.IN_REVIEW,
  $Enums.SolicitationStatus.APPROVED,
];

function mapSolicitation(row: {
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
  kind: $Enums.SolicitationKind | null;
  client: $Enums.SolicitationClient | null;
  activityType: $Enums.SolicitationActivityType | null;
  productType: $Enums.SolicitationProductType | null;
  priority: $Enums.SolicitationPriority | null;
  status: $Enums.SolicitationStatus;
  statusUpdatedAt: Date | null;
  statusUpdatedByUserId: string | null;
  kairoCardId: string | null;
  kairoTeamId: string | null;
  kairoSyncedAt: Date | null;
  kairoSyncedByUserId: string | null;
  deletedAt: Date | null;
  deletedByUserId: string | null;
  deletedByName: string | null;
  deletedFrom: $Enums.SolicitationDeletionSource | null;
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
    kind: row.kind,
    client: row.client,
    activityType: row.activityType,
    productType: row.productType,
    priority: row.priority,
    status: row.status,
    statusUpdatedAt: row.statusUpdatedAt?.toISOString() ?? null,
    statusUpdatedByUserId: row.statusUpdatedByUserId,
    kairoCardId: row.kairoCardId,
    kairoTeamId: row.kairoTeamId,
    kairoSyncedAt: row.kairoSyncedAt?.toISOString() ?? null,
    kairoSyncedByUserId: row.kairoSyncedByUserId,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    deletedByUserId: row.deletedByUserId,
    deletedByName: row.deletedByName,
    deletedFrom: row.deletedFrom,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapPublicTicket(row: {
  trackingCode: string;
  requesterName: string;
  unit: $Enums.Unit;
  sectorName: string;
  pillarOrLocation: string;
  title: string;
  description: string;
  status: $Enums.SolicitationStatus;
  statusUpdatedAt: Date | null;
  createdAt: Date;
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
    createdAt: row.createdAt.toISOString(),
    statusUpdatedAt: row.statusUpdatedAt?.toISOString() ?? null,
  };
}

function hasCompleteReview(row: {
  client: $Enums.SolicitationClient | null;
  activityType: $Enums.SolicitationActivityType | null;
  productType: $Enums.SolicitationProductType | null;
  priority: $Enums.SolicitationPriority | null;
}) {
  return Boolean(
    row.client &&
      row.activityType &&
      row.productType &&
      row.priority,
  );
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

  async create(input: {
    cardNumber: string;
    unit: $Enums.Unit;
    costCenter: string;
    pillarOrLocation: string;
    title: string;
    description: string;
    requesterEmail: string;
  }) {
    const requester = await this.validateRequester(
      input.cardNumber,
      input.unit,
    );
    const sector = await this.getSectorByCostCenter(input.costCenter);
    const requesterEmail = input.requesterEmail.trim().toLowerCase();

    const repo = new SolicitationPrismaRepository(prisma);
    const created = await repo.create({
      employeeId: requester.employeeId,
      requesterName: requester.name,
      requesterEmail,
      cardNumber: requester.cardNumber,
      unit: requester.unit,
      costCenter: sector.costCenter,
      sectorId: sector.id,
      sectorName: sector.name,
      pillarOrLocation: input.pillarOrLocation.trim(),
      title: input.title.trim(),
      description: input.description.trim(),
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
  }) {
    const repo = new SolicitationPrismaRepository(prisma);
    const { items, total } = await repo.findManyPaginated(input);
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

  async getById(id: string) {
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
      client: $Enums.SolicitationClient | null;
      activityType: $Enums.SolicitationActivityType | null;
      productType: $Enums.SolicitationProductType | null;
      priority: $Enums.SolicitationPriority | null;
      approve?: boolean;
    },
    actingUserId: string,
  ) {
    const repo = new SolicitationPrismaRepository(prisma);
    const existing = await repo.findById(id);
    if (!existing) {
      throw new HttpError('Solicitação não encontrada', 404);
    }

    const review = {
      client: input.client,
      activityType: input.activityType,
      productType: input.productType,
      priority: input.priority,
    };

    if (input.approve) {
      if (!hasCompleteReview(review)) {
        throw new HttpError(
          'Preencha cliente, tipo de atividade, tipo de produto e prioridade para aprovar',
          400,
        );
      }

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

    if (
      status === $Enums.SolicitationStatus.APPROVED &&
      !hasCompleteReview(existing)
    ) {
      throw new HttpError(
        'Preencha cliente, tipo de atividade, tipo de produto e prioridade antes de aprovar',
        400,
      );
    }

    const previousStatus = existing.status;
    const updated = await repo.updateStatus(id, status, actingUserId);

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
    const repo = new SolicitationPrismaRepository(prisma);
    const existing = await repo.findById(id);
    if (!existing) {
      throw new HttpError('Solicitação não encontrada', 404);
    }

    if (!OPEN_STATUSES.includes(existing.status)) {
      throw new HttpError(
        'Somente solicitações abertas (pendente, em análise ou aprovada) podem ser excluídas',
        400,
      );
    }

    const actor = await prisma.user.findUnique({
      where: { id: actingUserId },
      select: { id: true, name: true },
    });
    if (!actor) {
      throw new HttpError('Usuário não encontrado', 404);
    }

    if (existing.kairoCardId && existing.kairoTeamId) {
      const credentials = new KairoCredentialService();
      const client = await credentials.getClientForUser(actingUserId);

      try {
        if (existing.kind === $Enums.SolicitationKind.PROJETO) {
          await client.deleteProject(existing.kairoTeamId, existing.kairoCardId);
        } else if (existing.kind === $Enums.SolicitationKind.ATIVIDADE) {
          await client.deleteActivity(
            existing.kairoTeamId,
            existing.kairoCardId,
          );
        } else {
          try {
            await client.deleteActivity(
              existing.kairoTeamId,
              existing.kairoCardId,
            );
          } catch (activityError) {
            if (
              !(
                activityError instanceof HttpError &&
                activityError.statusCode === 404
              )
            ) {
              throw activityError;
            }
            await client.deleteProject(
              existing.kairoTeamId,
              existing.kairoCardId,
            );
          }
        }
      } catch (error) {
        if (error instanceof HttpError && error.statusCode === 404) {
          // Card já removido no Kairo — segue com soft-delete local.
        } else {
          throw error;
        }
      }

      await credentials.touchValidated(actingUserId);
    }

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

    if (existing.kairoCardId) {
      throw new HttpError('Esta solicitação já foi enviada ao Kairo', 400);
    }

    if (
      input.kind === $Enums.SolicitationKind.ATIVIDADE &&
      !input.tagId?.trim()
    ) {
      throw new HttpError(
        'Selecione uma etiqueta do Kairo para criar a atividade',
        400,
      );
    }

    const credentials = new KairoCredentialService();
    const client = await credentials.getClientForUser(actingUserId);

    let cardId: string;

    if (input.kind === $Enums.SolicitationKind.ATIVIDADE) {
      const { activity } = await client.createActivity(input.teamId, {
        title: input.title,
        description: input.description,
        tagId: input.tagId!.trim(),
        integrationSource: KAIRO_INTEGRATION_SOURCE,
      });
      cardId = activity.id;
    } else {
      const { project } = await client.createProject(input.teamId, {
        title: input.title,
        description: input.description,
        integrationSource: KAIRO_INTEGRATION_SOURCE,
        ...(input.estimatedHours !== undefined
          ? { estimatedHours: input.estimatedHours }
          : {}),
      });
      cardId = project.id;
    }

    await credentials.touchValidated(actingUserId);

    const updated = await repo.markKairoSynced(id, {
      kairoCardId: cardId,
      kairoTeamId: input.teamId,
      kairoSyncedByUserId: actingUserId,
      kind: input.kind,
    });

    return mapSolicitation(updated);
  }

  async syncFromKairo(id: string, actingUserId?: string) {
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

    if (!existing.kairoCardId || !existing.kairoTeamId) {
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

    const kairoCard = await this.fetchKairoCardStatus(
      client,
      existing.kairoTeamId,
      existing.kairoCardId,
      existing.kind,
    );

    if (!kairoCard) {
      return mapSolicitation(existing);
    }

    if (existing.kind !== kairoCard.kind) {
      await repo.updateKind(id, kairoCard.kind);
    }

    await credentials.touchValidated(credentialUserId);

    if (kairoCard.deletedAt) {
      const updated = await repo.markDeleted(id, {
        deletedByUserId: null,
        deletedByName: kairoCard.deletedByName?.trim() || 'Usuário do Kairo',
        deletedFrom: $Enums.SolicitationDeletionSource.KAIRO,
      });
      return mapSolicitation(updated);
    }

    if (kairoCard.status !== 'DONE') {
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

  async syncPendingFromKairo() {
    const repo = new SolicitationPrismaRepository(prisma);
    const pending = await repo.findPendingKairoSync();
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
  } | null> {
    const fetchByKind = async (kind: $Enums.SolicitationKind) => {
      if (kind === $Enums.SolicitationKind.ATIVIDADE) {
        const { activity } = await client.getActivity(teamId, cardId);
        return {
          kind,
          status: activity.status,
          deletedAt: activity.deletedAt ?? null,
          deletedByName: activity.deletedByName ?? null,
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
}

