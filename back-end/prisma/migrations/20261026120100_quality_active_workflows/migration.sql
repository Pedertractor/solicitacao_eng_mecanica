BEGIN;

-- Stop Pederflow during deployment: only uncommitted sample work receives PPAP.
CREATE TEMP TABLE quality_workflows ON COMMIT DROP AS
SELECT s."id", a."order" AS "sampleOrder"
FROM "Solicitation" s
JOIN "SolicitationWorkflowStage" a ON a."solicitationId" = s."id" AND a."stage" = 'AMOSTRA'
WHERE s."status" IN ('PENDING', 'IN_REVIEW', 'APPROVED')
  AND a."status" IN ('PENDING', 'READY')
  AND a."actualStartAt" IS NULL
  AND NULLIF(BTRIM(a."kairoCardIds"), '') IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "SolicitationWorkflowStage" q
    WHERE q."solicitationId" = s."id" AND q."stage" = 'QUALIDADE'
  );

INSERT INTO "SolicitationWorkflowStage"
  ("id", "solicitationId", "stage", "status", "order", "createdAt", "updatedAt")
SELECT md5("id" || ':QUALIDADE')::uuid::text, "id", 'QUALIDADE', 'READY', "sampleOrder", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM quality_workflows;

UPDATE "SolicitationWorkflowStage" a
SET "order" = q."sampleOrder" + 1, "status" = 'PENDING', "updatedAt" = CURRENT_TIMESTAMP
FROM quality_workflows q
WHERE a."solicitationId" = q."id" AND a."stage" = 'AMOSTRA';

COMMIT;
