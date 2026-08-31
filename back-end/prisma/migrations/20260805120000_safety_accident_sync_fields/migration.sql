-- AlterTable
ALTER TABLE "SafetyAccident" ADD COLUMN "sourceChangedAt" TIMESTAMP(3),
ADD COLUMN "cancelledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SafetyAccident_cycleId_status_accidentType_idx" ON "SafetyAccident"("cycleId", "status", "accidentType");
