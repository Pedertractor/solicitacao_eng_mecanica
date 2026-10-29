import { isCommercialSimulation, workflowKind } from './commercial-simulation.js';

type ConversionStage = {
  stage: string; status: string;
  actualStartAt?: unknown; actualEndAt?: unknown;
  kairoTeamId?: unknown; kairoCardIds?: unknown;
  kairoSyncedAt?: unknown; kairoSyncedByUserId?: unknown;
  completedByUserId?: unknown; rejectionReason?: unknown;
  rejectedAt?: unknown; rejectedByUserId?: unknown; rejectedByName?: unknown;
};

export function simulationConversionEligibility(row: Parameters<typeof isCommercialSimulation>[0] & {
  status: string; workflowStages: ConversionStage[];
}) {
  if (!isCommercialSimulation(row)) return { eligible: false, reason: 'Não é Simulação Comercial' };
  if (['COMPLETED', 'CANCELLED', 'DELETED'].includes(row.status)) return { eligible: false, reason: 'Chamado encerrado' };
  if (!row.workflowStages.some((stage) => stage.stage === 'ENGENHARIA')) return { eligible: false, reason: 'Fluxo sem Engenharia' };
  if (workflowKind(row) === 'COMMERCIAL_SIMULATION') return { eligible: false, reason: 'Já utiliza o novo fluxo' };
  const worked = row.workflowStages.find((stage) => stage.stage !== 'ENGENHARIA' && (
    !['PENDING', 'READY'].includes(stage.status)
    || stage.actualStartAt || stage.actualEndAt || stage.kairoTeamId || stage.kairoCardIds
    || stage.kairoSyncedAt || stage.kairoSyncedByUserId || stage.completedByUserId
    || stage.rejectionReason || stage.rejectedAt || stage.rejectedByUserId || stage.rejectedByName
  ));
  if (worked) return { eligible: false, reason: `Etapa ${worked.stage} possui trabalho ou integração registrada` };
  return { eligible: true, reason: 'Somente etapas não iniciadas serão removidas' };
}
