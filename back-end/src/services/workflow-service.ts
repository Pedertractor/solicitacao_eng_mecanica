import { HttpError } from '../https/errors/index.js';
import { prisma } from '../lib/prisma.js';
import { $Enums } from '../generated/prisma/client.js';
import {
  type AccessActor,
  canAccessSolicitation,
  canManageSampleStage,
  canManageToolingStage,
  solicitationScope,
} from '../auth/access-policy.js';
import {
  KAIRO_INTEGRATION_SOURCE,
  type KairoActivity,
} from '../integrations/kairo-client.js';
import { notifySolicitationCompleted } from '../lib/solicitation-mail.js';
import {
  engineeringStagePlannedEndAt,
  WORKFLOW_ENGINEERING_PERCENTAGE,
} from '../lib/process-instruction.js';
import {
  SolicitationPrismaRepository,
  type SolicitationWithWorkflow,
} from '../repositories/prisma/solicitation-repository.js';
import {
  WorkflowStagePrismaRepository,
  type CreateWorkflowStageInput,
} from '../repositories/prisma/workflow-stage-repository.js';
import { KairoCredentialService } from './kairo-credential-service.js';

const KAIRO_STARTED_STATUSES = new Set(['IN_PROGRESS', 'PAUSED']);

function splitCommaList(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function kairoObservedAt(
  activity: Pick<KairoActivity, 'startedAt' | 'finishedAt' | 'updatedAt'>,
  prefer: 'start' | 'finish' = 'finish',
): Date {
  const raw =
    prefer === 'start'
      ? (activity.startedAt ?? activity.updatedAt)
      : (activity.finishedAt ?? activity.updatedAt);
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export function mapWorkflowStage(row: {
  id: string;
  stage: $Enums.WorkflowStage;
  status: $Enums.WorkflowStageStatus;
  order: number;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  plannedDurationPercentage: { toString(): string } | null;
  actualStartAt: Date | null;
  actualEndAt: Date | null;
  kairoTeamId: string | null;
  kairoCardIds: string | null;
  kairoSyncedAt: Date | null;
  kairoSyncedByUserId: string | null;
  completedByUserId: string | null;
}) {
  return {
    id: row.id,
    stage: row.stage,
    status: row.status,
    order: row.order,
    plannedStartAt: row.plannedStartAt?.toISOString() ?? null,
    plannedEndAt: row.plannedEndAt?.toISOString() ?? null,
    plannedDurationPercentage:
      row.plannedDurationPercentage?.toString() ?? null,
    actualStartAt: row.actualStartAt?.toISOString() ?? null,
    actualEndAt: row.actualEndAt?.toISOString() ?? null,
    kairoTeamId: row.kairoTeamId,
    kairoCardIds: row.kairoCardIds,
    kairoSyncedAt: row.kairoSyncedAt?.toISOString() ?? null,
    kairoSyncedByUserId: row.kairoSyncedByUserId,
    completedByUserId: row.completedByUserId,
  };
}

export function mapWorkflow(row: {
  requiresTooling: boolean;
  workflowStages?: Array<{
    id: string;
    stage: $Enums.WorkflowStage;
    status: $Enums.WorkflowStageStatus;
    order: number;
    plannedStartAt: Date | null;
    plannedEndAt: Date | null;
    plannedDurationPercentage: { toString(): string } | null;
    actualStartAt: Date | null;
    actualEndAt: Date | null;
    kairoTeamId: string | null;
    kairoCardIds: string | null;
    kairoSyncedAt: Date | null;
    kairoSyncedByUserId: string | null;
    completedByUserId: string | null;
  }>;
}) {
  const stages = row.workflowStages ?? [];
  if (stages.length === 0) return null;
  return {
    requiresTooling: row.requiresTooling,
    stages: stages.map(mapWorkflowStage),
  };
}

export class WorkflowService {
  buildStagesForCreate(input: {
    requester: string;
    process: string;
    type: string;
    deliveryDateIso: string | null;
    requiresTooling: boolean;
    now?: Date;
  }): CreateWorkflowStageInput[] {
    const now = input.now ?? new Date();
    const plannedEndAt = engineeringStagePlannedEndAt({
      requester: input.requester,
      process: input.process,
      type: input.type,
      deliveryDateIso: input.deliveryDateIso,
      now,
    });

    const stages: CreateWorkflowStageInput[] = [
      {
        stage: $Enums.WorkflowStage.ENGENHARIA,
        order: 0,
        status: $Enums.WorkflowStageStatus.PENDING,
        plannedStartAt: now,
        plannedEndAt,
        plannedDurationPercentage: WORKFLOW_ENGINEERING_PERCENTAGE,
      },
    ];

    if (input.requiresTooling) {
      stages.push({
        stage: $Enums.WorkflowStage.FERRAMENTARIA,
        order: 1,
        status: $Enums.WorkflowStageStatus.PENDING,
      });
    }

    stages.push({
      stage: $Enums.WorkflowStage.AMOSTRA,
      order: input.requiresTooling ? 2 : 1,
      status: $Enums.WorkflowStageStatus.PENDING,
    });

    return stages;
  }

  async applyEngineeringKairoState(
    solicitation: SolicitationWithWorkflow,
    cards: Array<{
      status: string | undefined;
      deletedAt: string | null;
      startedAt?: string | null;
      finishedAt?: string | null;
      updatedAt?: string | null;
    }>,
  ): Promise<SolicitationWithWorkflow> {
    const engineering = solicitation.workflowStages.find(
      (stage) => stage.stage === $Enums.WorkflowStage.ENGENHARIA,
    );
    if (!engineering) return solicitation;
    if (
      engineering.status === $Enums.WorkflowStageStatus.DONE ||
      engineering.status === $Enums.WorkflowStageStatus.CANCELLED
    ) {
      return solicitation;
    }

    const activeCards = cards.filter((card) => !card.deletedAt);
    if (activeCards.length === 0) return solicitation;

    const workflowRepo = new WorkflowStagePrismaRepository(prisma);
    const solicitationRepo = new SolicitationPrismaRepository(prisma);

    if (activeCards.every((card) => card.status === 'DONE')) {
      const finishedAt = kairoObservedAt(activeCards[0]!, 'finish');
      await workflowRepo.markEngineeringFinished(solicitation.id, finishedAt);
      const refreshed = await solicitationRepo.findById(solicitation.id);
      return refreshed ?? solicitation;
    }

    if (
      engineering.status === $Enums.WorkflowStageStatus.PENDING &&
      activeCards.some(
        (card) => card.status && KAIRO_STARTED_STATUSES.has(card.status),
      )
    ) {
      const startedCard = activeCards.find(
        (card) => card.status && KAIRO_STARTED_STATUSES.has(card.status),
      )!;
      await workflowRepo.markEngineeringStarted(
        solicitation.id,
        kairoObservedAt(startedCard, 'start'),
      );
      const refreshed = await solicitationRepo.findById(solicitation.id);
      return refreshed ?? solicitation;
    }

    return solicitation;
  }

  async sendToolingToKairo(
    id: string,
    input: {
      teamId: string;
      title?: string;
      description?: string;
      tagId?: string;
    },
    actingUserId: string,
  ) {
    const actor = await this.loadActor(actingUserId);
    if (!canManageToolingStage(actor)) {
      throw new HttpError('Sem permissão para enviar ferramentaria ao Kairo', 403);
    }

    const solicitationRepo = new SolicitationPrismaRepository(prisma);
    const existing = await solicitationRepo.findById(id);
    if (!existing || !canAccessSolicitation(actor, existing)) {
      throw new HttpError('Solicitação não encontrada', 404);
    }

    const engineering = existing.workflowStages.find(
      (stage) => stage.stage === $Enums.WorkflowStage.ENGENHARIA,
    );
    const tooling = existing.workflowStages.find(
      (stage) => stage.stage === $Enums.WorkflowStage.FERRAMENTARIA,
    );

    if (!tooling) {
      throw new HttpError('Esta solicitação não possui etapa de ferramentaria', 400);
    }
    if (engineering?.status !== $Enums.WorkflowStageStatus.DONE) {
      throw new HttpError(
        'A etapa de engenharia precisa estar concluída antes de enviar à ferramentaria',
        400,
      );
    }
    if (
      tooling.status !== $Enums.WorkflowStageStatus.READY &&
      tooling.status !== $Enums.WorkflowStageStatus.PENDING
    ) {
      throw new HttpError('A etapa de ferramentaria não está liberada', 400);
    }
    if (tooling.kairoCardIds) {
      throw new HttpError('Ferramentaria já foi enviada ao Kairo', 400);
    }

    const credentials = new KairoCredentialService();
    const client = await credentials.getClientForUser(actingUserId);
    const trimmedTagId = input.tagId?.trim() || undefined;

    const { activity } = await client.createActivity(input.teamId, {
      title: input.title?.trim() || existing.title,
      description:
        input.description?.trim() ||
        [
          `Solicitação: ${existing.trackingCode}`,
          `Título: ${existing.title}`,
          'Etapa: Ferramentaria',
        ].join('\n'),
      integrationSource: KAIRO_INTEGRATION_SOURCE,
      ...(trimmedTagId ? { tagId: trimmedTagId } : {}),
    });

    await credentials.touchValidated(actingUserId);

    const workflowRepo = new WorkflowStagePrismaRepository(prisma);
    await workflowRepo.setToolingKairo(id, {
      kairoTeamId: input.teamId,
      kairoCardIds: activity.id,
      kairoSyncedByUserId: actingUserId,
    });

    const refreshed = await solicitationRepo.findById(id);
    if (!refreshed) {
      throw new HttpError('Solicitação não encontrada', 404);
    }
    return refreshed;
  }

  async syncToolingFromKairo(id: string, actingUserId?: string) {
    if (actingUserId) {
      const actor = await this.loadActor(actingUserId);
      if (!canManageToolingStage(actor)) {
        throw new HttpError('Sem permissão para sincronizar ferramentaria', 403);
      }
      const solicitationRepo = new SolicitationPrismaRepository(prisma);
      const existing = await solicitationRepo.findById(id);
      if (!existing || !canAccessSolicitation(actor, existing)) {
        throw new HttpError('Solicitação não encontrada', 404);
      }
    }

    return this.syncToolingForSolicitation(id, actingUserId);
  }

  async syncPendingToolingFromKairo() {
    const workflowRepo = new WorkflowStagePrismaRepository(prisma);
    const pending = await workflowRepo.findPendingToolingKairoSync();
    let updated = 0;

    for (const stage of pending) {
      try {
        const before = stage.status;
        const result = await this.syncToolingForSolicitation(
          stage.solicitationId,
        );
        const after = result.workflowStages.find(
          (item) => item.stage === $Enums.WorkflowStage.FERRAMENTARIA,
        )?.status;
        if (after && after !== before) updated += 1;
      } catch (error) {
        console.error(
          `[workflow-tooling-sync] Falha ao sincronizar ${stage.solicitationId}:`,
          error,
        );
      }
    }

    return { checked: pending.length, updated };
  }

  async sendSampleToKairo(
    id: string,
    input: {
      teamId: string;
      title?: string;
      description?: string;
      tagId?: string;
    },
    actingUserId: string,
  ) {
    const actor = await this.loadActor(actingUserId);
    if (!canManageSampleStage(actor)) {
      throw new HttpError('Sem permissão para enviar amostra ao Kairo', 403);
    }

    const solicitationRepo = new SolicitationPrismaRepository(prisma);
    const existing = await solicitationRepo.findById(id);
    if (!existing || !canAccessSolicitation(actor, existing)) {
      throw new HttpError('Solicitação não encontrada', 404);
    }

    const engineering = existing.workflowStages.find(
      (stage) => stage.stage === $Enums.WorkflowStage.ENGENHARIA,
    );
    const tooling = existing.workflowStages.find(
      (stage) => stage.stage === $Enums.WorkflowStage.FERRAMENTARIA,
    );
    const sample = existing.workflowStages.find(
      (stage) => stage.stage === $Enums.WorkflowStage.AMOSTRA,
    );

    if (!sample) {
      throw new HttpError('Esta solicitação não possui etapa de amostra', 400);
    }
    if (tooling) {
      if (tooling.status !== $Enums.WorkflowStageStatus.DONE) {
        throw new HttpError(
          'A etapa de ferramentaria precisa estar concluída antes de enviar à amostra',
          400,
        );
      }
    } else if (engineering?.status !== $Enums.WorkflowStageStatus.DONE) {
      throw new HttpError(
        'A etapa de engenharia precisa estar concluída antes de enviar à amostra',
        400,
      );
    }
    if (
      sample.status !== $Enums.WorkflowStageStatus.READY &&
      sample.status !== $Enums.WorkflowStageStatus.PENDING
    ) {
      throw new HttpError('A etapa de amostra não está liberada', 400);
    }
    if (sample.kairoCardIds) {
      throw new HttpError('Amostra já foi enviada ao Kairo', 400);
    }

    const credentials = new KairoCredentialService();
    const client = await credentials.getClientForUser(actingUserId);
    const trimmedTagId = input.tagId?.trim() || undefined;

    const { activity } = await client.createActivity(input.teamId, {
      title: input.title?.trim() || existing.title,
      description:
        input.description?.trim() ||
        [
          `Solicitação: ${existing.trackingCode}`,
          `Título: ${existing.title}`,
          'Etapa: Amostra',
        ].join('\n'),
      integrationSource: KAIRO_INTEGRATION_SOURCE,
      ...(trimmedTagId ? { tagId: trimmedTagId } : {}),
    });

    await credentials.touchValidated(actingUserId);

    const workflowRepo = new WorkflowStagePrismaRepository(prisma);
    await workflowRepo.setSampleKairo(id, {
      kairoTeamId: input.teamId,
      kairoCardIds: activity.id,
      kairoSyncedByUserId: actingUserId,
    });

    const refreshed = await solicitationRepo.findById(id);
    if (!refreshed) {
      throw new HttpError('Solicitação não encontrada', 404);
    }
    return refreshed;
  }

  async syncSampleFromKairo(id: string, actingUserId?: string) {
    if (actingUserId) {
      const actor = await this.loadActor(actingUserId);
      if (!canManageSampleStage(actor)) {
        throw new HttpError('Sem permissão para sincronizar amostra', 403);
      }
      const solicitationRepo = new SolicitationPrismaRepository(prisma);
      const existing = await solicitationRepo.findById(id);
      if (!existing || !canAccessSolicitation(actor, existing)) {
        throw new HttpError('Solicitação não encontrada', 404);
      }
    }

    return this.syncSampleForSolicitation(id, actingUserId);
  }

  async syncPendingSampleFromKairo() {
    const workflowRepo = new WorkflowStagePrismaRepository(prisma);
    const pending = await workflowRepo.findPendingSampleKairoSync();
    let updated = 0;

    for (const stage of pending) {
      try {
        const before = stage.status;
        const result = await this.syncSampleForSolicitation(
          stage.solicitationId,
        );
        const after = result.workflowStages.find(
          (item) => item.stage === $Enums.WorkflowStage.AMOSTRA,
        )?.status;
        if (after && after !== before) updated += 1;
      } catch (error) {
        console.error(
          `[workflow-sample-sync] Falha ao sincronizar ${stage.solicitationId}:`,
          error,
        );
      }
    }

    return { checked: pending.length, updated };
  }

  async cancelOpenStages(solicitationId: string) {
    const workflowRepo = new WorkflowStagePrismaRepository(prisma);
    return workflowRepo.cancelOpenStages(solicitationId);
  }

  async summary(actor: AccessActor) {
    const workflowRepo = new WorkflowStagePrismaRepository(prisma);
    const rows = await workflowRepo.summary(solicitationScope(actor));

    const stages: $Enums.WorkflowStage[] = [
      $Enums.WorkflowStage.ENGENHARIA,
      $Enums.WorkflowStage.FERRAMENTARIA,
      $Enums.WorkflowStage.AMOSTRA,
    ];

    return {
      stages: stages.map((stage) => {
        const stageRows = rows.filter((row) => row.stage === stage);
        const total = stageRows.reduce((sum, row) => sum + row.count, 0);
        const inProgress =
          stageRows.find(
            (row) => row.status === $Enums.WorkflowStageStatus.IN_PROGRESS,
          )?.count ?? 0;
        const waiting =
          (stageRows.find(
            (row) => row.status === $Enums.WorkflowStageStatus.READY,
          )?.count ?? 0) +
          (stageRows.find(
            (row) => row.status === $Enums.WorkflowStageStatus.PENDING,
          )?.count ?? 0);
        const done =
          stageRows.find((row) => row.status === $Enums.WorkflowStageStatus.DONE)
            ?.count ?? 0;

        return { stage, total, inProgress, waiting, done };
      }),
    };
  }

  private async syncToolingForSolicitation(
    id: string,
    actingUserId?: string,
  ): Promise<SolicitationWithWorkflow> {
    const solicitationRepo = new SolicitationPrismaRepository(prisma);
    const existing = await solicitationRepo.findById(id);
    if (!existing) {
      throw new HttpError('Solicitação não encontrada', 404);
    }

    const tooling = existing.workflowStages.find(
      (stage) => stage.stage === $Enums.WorkflowStage.FERRAMENTARIA,
    );
    if (!tooling?.kairoTeamId || !tooling.kairoCardIds) {
      return existing;
    }

    const cardIds = splitCommaList(tooling.kairoCardIds);
    if (cardIds.length === 0) return existing;

    const resolved = await this.resolveKairoClient(
      [actingUserId, tooling.kairoSyncedByUserId],
      actingUserId,
    );
    if (!resolved) return existing;

    const activities: KairoActivity[] = [];
    for (const cardId of cardIds) {
      const { activity } = await resolved.client.getActivity(
        tooling.kairoTeamId,
        cardId,
      );
      activities.push(activity);
    }

    await new KairoCredentialService().touchValidated(resolved.credentialUserId);

    const workflowRepo = new WorkflowStagePrismaRepository(prisma);

    if (activities.every((activity) => activity.deletedAt)) {
      await workflowRepo.clearToolingKairo(id);
      const refreshed = await solicitationRepo.findById(id);
      return refreshed ?? existing;
    }

    const active = activities.filter((activity) => !activity.deletedAt);
    if (active.length === 0) return existing;

    if (active.every((activity) => activity.status === 'DONE')) {
      await workflowRepo.markToolingFinished(
        id,
        kairoObservedAt(active[0]!, 'finish'),
      );
      const refreshed = await solicitationRepo.findById(id);
      return refreshed ?? existing;
    }

    if (
      (tooling.status === $Enums.WorkflowStageStatus.READY ||
        tooling.status === $Enums.WorkflowStageStatus.PENDING) &&
      active.some(
        (activity) =>
          activity.status && KAIRO_STARTED_STATUSES.has(activity.status),
      )
    ) {
      const started = active.find(
        (activity) =>
          activity.status && KAIRO_STARTED_STATUSES.has(activity.status),
      )!;
      await workflowRepo.markToolingStarted(
        id,
        kairoObservedAt(started, 'start'),
      );
      const refreshed = await solicitationRepo.findById(id);
      return refreshed ?? existing;
    }

    return existing;
  }

  private async syncSampleForSolicitation(
    id: string,
    actingUserId?: string,
  ): Promise<SolicitationWithWorkflow> {
    const solicitationRepo = new SolicitationPrismaRepository(prisma);
    const existing = await solicitationRepo.findById(id);
    if (!existing) {
      throw new HttpError('Solicitação não encontrada', 404);
    }

    const sample = existing.workflowStages.find(
      (stage) => stage.stage === $Enums.WorkflowStage.AMOSTRA,
    );
    if (!sample?.kairoTeamId || !sample.kairoCardIds) {
      return existing;
    }

    const cardIds = splitCommaList(sample.kairoCardIds);
    if (cardIds.length === 0) return existing;

    const resolved = await this.resolveKairoClient(
      [actingUserId, sample.kairoSyncedByUserId],
      actingUserId,
    );
    if (!resolved) return existing;

    const activities: KairoActivity[] = [];
    for (const cardId of cardIds) {
      const { activity } = await resolved.client.getActivity(
        sample.kairoTeamId,
        cardId,
      );
      activities.push(activity);
    }

    await new KairoCredentialService().touchValidated(resolved.credentialUserId);

    const workflowRepo = new WorkflowStagePrismaRepository(prisma);

    if (activities.every((activity) => activity.deletedAt)) {
      await workflowRepo.clearSampleKairo(id);
      const refreshed = await solicitationRepo.findById(id);
      return refreshed ?? existing;
    }

    const active = activities.filter((activity) => !activity.deletedAt);
    if (active.length === 0) return existing;

    if (active.every((activity) => activity.status === 'DONE')) {
      const finishedAt = kairoObservedAt(active[0]!, 'finish');
      await workflowRepo.markSampleFinished(
        id,
        finishedAt,
        sample.kairoSyncedByUserId ?? resolved.credentialUserId,
      );

      if (existing.status !== $Enums.SolicitationStatus.COMPLETED) {
        const updated = await solicitationRepo.updateStatus(
          id,
          $Enums.SolicitationStatus.COMPLETED,
          sample.kairoSyncedByUserId ?? resolved.credentialUserId,
        );
        await notifySolicitationCompleted(updated);
        return updated;
      }

      const refreshed = await solicitationRepo.findById(id);
      return refreshed ?? existing;
    }

    if (
      (sample.status === $Enums.WorkflowStageStatus.READY ||
        sample.status === $Enums.WorkflowStageStatus.PENDING) &&
      active.some(
        (activity) =>
          activity.status && KAIRO_STARTED_STATUSES.has(activity.status),
      )
    ) {
      const started = active.find(
        (activity) =>
          activity.status && KAIRO_STARTED_STATUSES.has(activity.status),
      )!;
      await workflowRepo.markSampleStarted(
        id,
        kairoObservedAt(started, 'start'),
      );
      const refreshed = await solicitationRepo.findById(id);
      return refreshed ?? existing;
    }

    return existing;
  }

  private async resolveKairoClient(
    candidateUserIds: Array<string | null | undefined>,
    actingUserId?: string,
  ) {
    const credentials = new KairoCredentialService();
    const ids = candidateUserIds.filter((value): value is string =>
      Boolean(value),
    );

    for (const userId of ids) {
      const client = await credentials.tryGetClientForUser(userId);
      if (client) {
        return { client, credentialUserId: userId };
      }
    }

    if (actingUserId) {
      throw new HttpError(
        'Vincule sua chave de API do Kairo em Integrações antes de sincronizar',
        400,
      );
    }
    return null;
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
}
