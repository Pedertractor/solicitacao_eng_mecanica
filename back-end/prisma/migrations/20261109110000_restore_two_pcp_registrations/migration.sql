BEGIN;

-- Restore the tooling registration after tooling; retain worked legacy gates.
CREATE TEMP TABLE two_pcp_workflows ON COMMIT DROP AS
SELECT s."id" FROM "Solicitation" s
LEFT JOIN "SolicitationWorkflowStage" p ON p."solicitationId" = s."id" AND p."stage" = 'PCP_FERRAMENTARIA'
WHERE s."department" = 'DESENVOLVIMENTO_PROCESSOS' AND s."processInstructionRequester" = 'Comercial'
  AND s."status" IN ('PENDING', 'IN_REVIEW', 'APPROVED') AND s."requiresTooling" AND NOT s."directTooling"
  AND (p."id" IS NULL OR (p."status" IN ('PENDING', 'READY')
    AND p."actualStartAt" IS NULL AND p."actualEndAt" IS NULL AND p."completedByUserId" IS NULL
    AND p."kairoCardIds" IS NULL AND p."kairoTeamId" IS NULL
    AND p."kairoSyncedAt" IS NULL AND p."kairoSyncedByUserId" IS NULL))
  AND EXISTS (SELECT 1 FROM "SolicitationWorkflowStage" w WHERE w."solicitationId" = s."id" AND w."stage" = 'ENGENHARIA')
  AND EXISTS (SELECT 1 FROM "SolicitationWorkflowStage" w WHERE w."solicitationId" = s."id" AND w."stage" = 'FERRAMENTARIA')
  AND EXISTS (SELECT 1 FROM "SolicitationWorkflowStage" w WHERE w."solicitationId" = s."id" AND w."stage" = 'PCP_AMOSTRA');

INSERT INTO "SolicitationWorkflowStage" ("id", "solicitationId", "stage", "status", "order", "actualStartAt", "actualEndAt", "updatedAt")
SELECT md5(f."id" || ':PCP_FERRAMENTARIA:restored')::uuid::text, f."id", 'PCP_FERRAMENTARIA',
  -- Preserve an already-started downstream registration as a historical handoff.
  CASE WHEN a."status" IN ('IN_PROGRESS', 'DONE', 'REJECTED') OR a."actualStartAt" IS NOT NULL OR a."kairoCardIds" IS NOT NULL
    THEN 'DONE' ELSE 'PENDING' END::"WorkflowStageStatus", 2,
  CASE WHEN a."status" IN ('IN_PROGRESS', 'DONE', 'REJECTED') OR a."actualStartAt" IS NOT NULL OR a."kairoCardIds" IS NOT NULL
    THEN COALESCE(a."actualStartAt", a."kairoSyncedAt", CURRENT_TIMESTAMP) END,
  CASE WHEN a."status" IN ('IN_PROGRESS', 'DONE', 'REJECTED') OR a."actualStartAt" IS NOT NULL OR a."kairoCardIds" IS NOT NULL
    THEN COALESCE(a."actualStartAt", a."kairoSyncedAt", CURRENT_TIMESTAMP) END,
  CURRENT_TIMESTAMP
FROM two_pcp_workflows f JOIN "SolicitationWorkflowStage" a ON a."solicitationId" = f."id" AND a."stage" = 'PCP_AMOSTRA'
ON CONFLICT ("solicitationId", "stage") DO NOTHING;

UPDATE "SolicitationWorkflowStage" w SET "order" = CASE w."stage"
  WHEN 'ENGENHARIA' THEN 0 WHEN 'FERRAMENTARIA' THEN 1 WHEN 'PCP_FERRAMENTARIA' THEN 2
  WHEN 'PCP_AMOSTRA' THEN 3 WHEN 'QUALIDADE' THEN 4 WHEN 'AMOSTRA' THEN 5 ELSE w."order" END,
  "updatedAt" = CURRENT_TIMESTAMP
FROM two_pcp_workflows f WHERE w."solicitationId" = f."id";

UPDATE "SolicitationWorkflowStage" w SET "status" = CASE
  WHEN w."stage" = 'FERRAMENTARIA' THEN 'READY'
  WHEN w."stage" = 'PCP_FERRAMENTARIA' AND EXISTS (SELECT 1 FROM "SolicitationWorkflowStage" t
    WHERE t."solicitationId" = w."solicitationId" AND t."stage" = 'FERRAMENTARIA' AND t."status" IN ('DONE', 'REJECTED')) THEN 'READY'
  WHEN w."stage" = 'PCP_AMOSTRA' AND EXISTS (SELECT 1 FROM "SolicitationWorkflowStage" t
    WHERE t."solicitationId" = w."solicitationId" AND t."stage" = 'FERRAMENTARIA' AND t."status" IN ('DONE', 'REJECTED'))
    AND EXISTS (SELECT 1 FROM "SolicitationWorkflowStage" p WHERE p."solicitationId" = w."solicitationId"
      AND p."stage" = 'PCP_FERRAMENTARIA' AND p."status" IN ('DONE', 'REJECTED')) THEN 'READY'
  ELSE 'PENDING' END::"WorkflowStageStatus", "updatedAt" = CURRENT_TIMESTAMP
FROM two_pcp_workflows f WHERE w."solicitationId" = f."id"
  AND w."stage" IN ('FERRAMENTARIA', 'PCP_FERRAMENTARIA', 'PCP_AMOSTRA')
  AND w."status" IN ('PENDING', 'READY') AND w."actualStartAt" IS NULL AND w."kairoCardIds" IS NULL;

COMMIT;
