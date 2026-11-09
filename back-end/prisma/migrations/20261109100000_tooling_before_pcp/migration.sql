BEGIN;

-- Upgrade active Commercial -> Process Engineering workflows only when the
-- initial PCP step has no work or integration history. Keep worked/closed flows.
CREATE TEMP TABLE tooling_first_workflows ON COMMIT DROP AS
SELECT s."id"
FROM "Solicitation" s
JOIN "SolicitationWorkflowStage" p ON p."solicitationId" = s."id" AND p."stage" = 'PCP_FERRAMENTARIA'
WHERE s."department" = 'DESENVOLVIMENTO_PROCESSOS'
  AND s."processInstructionRequester" = 'Comercial'
  AND s."status" IN ('PENDING', 'IN_REVIEW', 'APPROVED')
  AND s."requiresTooling" AND NOT s."directTooling"
  AND p."status" IN ('PENDING', 'READY')
  AND p."actualStartAt" IS NULL AND p."actualEndAt" IS NULL
  AND p."kairoCardIds" IS NULL AND p."kairoTeamId" IS NULL
  AND p."kairoSyncedAt" IS NULL AND p."kairoSyncedByUserId" IS NULL
  AND p."completedByUserId" IS NULL
  AND EXISTS (SELECT 1 FROM "SolicitationWorkflowStage" w WHERE w."solicitationId" = s."id" AND w."stage" = 'ENGENHARIA')
  AND EXISTS (SELECT 1 FROM "SolicitationWorkflowStage" w WHERE w."solicitationId" = s."id" AND w."stage" = 'FERRAMENTARIA')
  AND EXISTS (SELECT 1 FROM "SolicitationWorkflowStage" w WHERE w."solicitationId" = s."id" AND w."stage" = 'PCP_AMOSTRA');

DELETE FROM "SolicitationWorkflowStage" w USING tooling_first_workflows f
WHERE w."solicitationId" = f."id" AND w."stage" = 'PCP_FERRAMENTARIA';

UPDATE "SolicitationWorkflowStage" w
SET "order" = CASE w."stage" WHEN 'ENGENHARIA' THEN 0 WHEN 'FERRAMENTARIA' THEN 1
  WHEN 'PCP_AMOSTRA' THEN 2 WHEN 'QUALIDADE' THEN 3 WHEN 'AMOSTRA' THEN 4 ELSE w."order" END,
  "status" = CASE
    WHEN w."stage" = 'FERRAMENTARIA' AND w."status" IN ('PENDING', 'READY') THEN 'READY'::"WorkflowStageStatus"
    WHEN w."stage" = 'PCP_AMOSTRA' AND w."status" IN ('PENDING', 'READY') THEN
      CASE WHEN EXISTS (SELECT 1 FROM "SolicitationWorkflowStage" t WHERE t."solicitationId" = w."solicitationId"
        AND t."stage" = 'FERRAMENTARIA' AND t."status" IN ('DONE', 'REJECTED'))
        THEN 'READY' ELSE 'PENDING' END::"WorkflowStageStatus"
    ELSE w."status" END,
  "updatedAt" = CURRENT_TIMESTAMP
FROM tooling_first_workflows f WHERE w."solicitationId" = f."id";

COMMIT;
