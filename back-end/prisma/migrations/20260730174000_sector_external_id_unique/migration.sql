-- Deduplicate Sector rows sharing the same externalId (keep oldest)
WITH ranked AS (
  SELECT id, "externalId",
    ROW_NUMBER() OVER (PARTITION BY "externalId" ORDER BY "createdAt" ASC) AS rn
  FROM "Sector"
)
UPDATE "Employee" e
SET "currentSectorId" = keep.id
FROM ranked dup
JOIN ranked keep ON keep."externalId" = dup."externalId" AND keep.rn = 1
WHERE dup.rn > 1
  AND e."currentSectorId" = dup.id;

WITH ranked AS (
  SELECT id, "externalId",
    ROW_NUMBER() OVER (PARTITION BY "externalId" ORDER BY "createdAt" ASC) AS rn
  FROM "Sector"
)
UPDATE "CycleParticipant" cp
SET "sectorId" = keep.id
FROM ranked dup
JOIN ranked keep ON keep."externalId" = dup."externalId" AND keep.rn = 1
WHERE dup.rn > 1
  AND cp."sectorId" = dup.id;

WITH ranked AS (
  SELECT id, "externalId",
    ROW_NUMBER() OVER (PARTITION BY "externalId" ORDER BY "createdAt" ASC) AS rn
  FROM "Sector"
)
UPDATE "SafetyAccident" sa
SET "sectorId" = keep.id
FROM ranked dup
JOIN ranked keep ON keep."externalId" = dup."externalId" AND keep.rn = 1
WHERE dup.rn > 1
  AND sa."sectorId" = dup.id;

WITH ranked AS (
  SELECT id, "externalId",
    ROW_NUMBER() OVER (PARTITION BY "externalId" ORDER BY "createdAt" ASC) AS rn
  FROM "Sector"
)
UPDATE "IndicatorResult" ir
SET "sectorId" = keep.id
FROM ranked dup
JOIN ranked keep ON keep."externalId" = dup."externalId" AND keep.rn = 1
WHERE dup.rn > 1
  AND ir."sectorId" = dup.id;

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY "externalId" ORDER BY "createdAt" ASC) AS rn
  FROM "Sector"
)
DELETE FROM "Sector" s
USING ranked r
WHERE s.id = r.id AND r.rn > 1;

DROP INDEX IF EXISTS "Sector_externalId_unit_key";
ALTER TABLE "Sector" ALTER COLUMN "unit" DROP NOT NULL;
CREATE UNIQUE INDEX "Sector_externalId_key" ON "Sector"("externalId");