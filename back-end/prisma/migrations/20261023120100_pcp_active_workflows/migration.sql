BEGIN;

-- Only active commercial workflows are upgraded; closed history is unchanged.
CREATE TEMP TABLE pcp_workflows ON COMMIT DROP AS
SELECT s."id", s."requiresTooling"
FROM "Solicitation" s
WHERE s."department" = 'DESENVOLVIMENTO_PROCESSOS'
  AND s."processInstructionRequester" = 'Comercial'
  AND s."status" IN ('PENDING', 'IN_REVIEW', 'APPROVED')
  AND EXISTS (SELECT 1 FROM "SolicitationWorkflowStage" w WHERE w."solicitationId" = s."id");

-- Existing downstream work implies its preceding PCP handoff already occurred.
-- Preserve all engineering/tooling/sample work, dates and Kairo links.
INSERT INTO "SolicitationWorkflowStage"
  ("id", "solicitationId", "stage", "status", "order", "actualStartAt", "actualEndAt", "createdAt", "updatedAt")
SELECT md5(p."id" || ':PCP_FERRAMENTARIA')::uuid::text, p."id", 'PCP_FERRAMENTARIA',
  CASE WHEN w."status" IN ('IN_PROGRESS', 'DONE') OR w."kairoCardIds" IS NOT NULL
    OR a."status" IN ('IN_PROGRESS', 'DONE') OR a."kairoCardIds" IS NOT NULL
    THEN 'DONE' ELSE 'READY' END::"WorkflowStageStatus", 1,
  CASE WHEN w."status" IN ('IN_PROGRESS', 'DONE') OR w."kairoCardIds" IS NOT NULL
    OR a."status" IN ('IN_PROGRESS', 'DONE') OR a."kairoCardIds" IS NOT NULL
    THEN COALESCE(w."actualStartAt", w."kairoSyncedAt", a."actualStartAt", CURRENT_TIMESTAMP) END,
  CASE WHEN w."status" IN ('IN_PROGRESS', 'DONE') OR w."kairoCardIds" IS NOT NULL
    OR a."status" IN ('IN_PROGRESS', 'DONE') OR a."kairoCardIds" IS NOT NULL
    THEN COALESCE(w."actualStartAt", w."kairoSyncedAt", a."actualStartAt", CURRENT_TIMESTAMP) END,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM pcp_workflows p
LEFT JOIN "SolicitationWorkflowStage" w ON w."solicitationId" = p."id" AND w."stage" = 'FERRAMENTARIA'
LEFT JOIN "SolicitationWorkflowStage" a ON a."solicitationId" = p."id" AND a."stage" = 'AMOSTRA'
WHERE p."requiresTooling"
ON CONFLICT ("solicitationId", "stage") DO NOTHING;

INSERT INTO "SolicitationWorkflowStage"
  ("id", "solicitationId", "stage", "status", "order", "actualStartAt", "actualEndAt", "createdAt", "updatedAt")
SELECT md5(p."id" || ':PCP_AMOSTRA')::uuid::text, p."id", 'PCP_AMOSTRA',
  CASE WHEN a."status" IN ('IN_PROGRESS', 'DONE') OR a."kairoCardIds" IS NOT NULL THEN 'DONE'
    WHEN previous."status" = 'DONE' THEN 'READY' ELSE 'PENDING' END::"WorkflowStageStatus",
  CASE WHEN p."requiresTooling" THEN 3 ELSE 1 END,
  CASE WHEN a."status" IN ('IN_PROGRESS', 'DONE') OR a."kairoCardIds" IS NOT NULL
    THEN COALESCE(a."actualStartAt", a."kairoSyncedAt", CURRENT_TIMESTAMP) END,
  CASE WHEN a."status" IN ('IN_PROGRESS', 'DONE') OR a."kairoCardIds" IS NOT NULL
    THEN COALESCE(a."actualStartAt", a."kairoSyncedAt", CURRENT_TIMESTAMP) END,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM pcp_workflows p
LEFT JOIN "SolicitationWorkflowStage" a ON a."solicitationId" = p."id" AND a."stage" = 'AMOSTRA'
LEFT JOIN "SolicitationWorkflowStage" previous ON previous."solicitationId" = p."id"
  AND previous."stage" = CASE WHEN p."requiresTooling" THEN 'FERRAMENTARIA' ELSE 'ENGENHARIA' END::"WorkflowStage"
ON CONFLICT ("solicitationId", "stage") DO NOTHING;

UPDATE "SolicitationWorkflowStage" w
SET "order" = CASE w."stage" WHEN 'ENGENHARIA' THEN 0 WHEN 'FERRAMENTARIA' THEN 2
  WHEN 'AMOSTRA' THEN CASE WHEN p."requiresTooling" THEN 4 ELSE 2 END ELSE w."order" END,
  "updatedAt" = CURRENT_TIMESTAMP
FROM pcp_workflows p WHERE w."solicitationId" = p."id";

UPDATE "SolicitationWorkflowStage" w
SET "status" = CASE WHEN EXISTS (
  SELECT 1 FROM "SolicitationWorkflowStage" d WHERE d."solicitationId" = w."solicitationId"
    AND d."stage" = 'PCP_FERRAMENTARIA' AND d."status" = 'DONE'
) THEN 'READY' ELSE 'PENDING' END::"WorkflowStageStatus", "updatedAt" = CURRENT_TIMESTAMP
FROM pcp_workflows p WHERE w."solicitationId" = p."id" AND w."stage" = 'FERRAMENTARIA'
  AND w."status" IN ('PENDING', 'READY') AND w."kairoCardIds" IS NULL;

UPDATE "SolicitationWorkflowStage" w
SET "status" = CASE WHEN NOT EXISTS (
  SELECT 1 FROM unnest(CASE WHEN p."requiresTooling"
    THEN ARRAY['ENGENHARIA', 'PCP_FERRAMENTARIA', 'FERRAMENTARIA', 'PCP_AMOSTRA']
    ELSE ARRAY['ENGENHARIA', 'PCP_AMOSTRA'] END) AS required(stage)
  WHERE NOT EXISTS (SELECT 1 FROM "SolicitationWorkflowStage" d
    WHERE d."solicitationId" = w."solicitationId" AND d."stage"::text = required.stage AND d."status" = 'DONE')
) THEN 'READY' ELSE 'PENDING' END::"WorkflowStageStatus", "updatedAt" = CURRENT_TIMESTAMP
FROM pcp_workflows p WHERE w."solicitationId" = p."id" AND w."stage" = 'AMOSTRA'
  AND w."status" IN ('PENDING', 'READY') AND w."kairoCardIds" IS NULL;

COMMIT;
