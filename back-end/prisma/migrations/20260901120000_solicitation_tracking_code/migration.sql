-- AlterTable
ALTER TABLE "Solicitation" ADD COLUMN "trackingCode" TEXT;

-- Backfill existing rows
UPDATE "Solicitation"
SET "trackingCode" = 'SEM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
WHERE "trackingCode" IS NULL;

ALTER TABLE "Solicitation" ALTER COLUMN "trackingCode" SET NOT NULL;

CREATE UNIQUE INDEX "Solicitation_trackingCode_key" ON "Solicitation"("trackingCode");
