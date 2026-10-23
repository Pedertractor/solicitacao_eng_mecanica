import { prisma } from '../lib/prisma.js';
import { SolicitationService } from './solicitation-service.js';
import { WorkflowService } from './workflow-service.js';

export function hasLinkedKairoCard(ids: string | null, cardId: string) {
  return (ids ?? '').split(',').some((id) => id.trim() === cardId);
}

/** The event is a hint only: personal credentials fetch authoritative Kairo data. */
export async function syncKairoWebhookCard(teamId: string, cardId: string) {
  const solicitations = await prisma.solicitation.findMany({
    where: {
      kairoTeamId: teamId,
      OR: [{ kairoCardId: cardId }, { kairoCardIds: { contains: cardId } }],
    },
    select: { id: true, kairoCardId: true, kairoCardIds: true },
  });
  const stages = await prisma.solicitationWorkflowStage.findMany({
    where: { kairoTeamId: teamId, kairoCardIds: { contains: cardId } },
    select: { solicitationId: true, stage: true, kairoCardIds: true },
  });
  const service = new SolicitationService();
  const workflow = new WorkflowService();
  let synced = 0;
  for (const item of solicitations) {
    if (item.kairoCardId !== cardId && !hasLinkedKairoCard(item.kairoCardIds, cardId)) continue;
    await service.syncFromKairo(item.id);
    synced += 1;
  }
  for (const item of stages) {
    if (!hasLinkedKairoCard(item.kairoCardIds, cardId)) continue;
    if (item.stage === 'FERRAMENTARIA') {
      await workflow.syncToolingFromKairo(item.solicitationId);
      synced += 1;
    } else if (item.stage === 'AMOSTRA') {
      await workflow.syncSampleFromKairo(item.solicitationId);
      synced += 1;
    }
  }
  return { synced };
}
