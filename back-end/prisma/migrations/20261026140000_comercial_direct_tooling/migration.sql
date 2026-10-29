ALTER TABLE "Solicitation"
  ADD COLUMN "executionUnit" "Unit",
  ADD COLUMN "directTooling" BOOLEAN NOT NULL DEFAULT false;
