-- CreateEnum
CREATE TYPE "WorkflowStage" AS ENUM ('ENGENHARIA', 'FERRAMENTARIA', 'AMOSTRA');

-- CreateEnum
CREATE TYPE "WorkflowStageStatus" AS ENUM ('PENDING', 'READY', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'COMERCIAL';
ALTER TYPE "UserRole" ADD VALUE 'FERRAMENTARIA';
ALTER TYPE "UserRole" ADD VALUE 'AMOSTRA';

-- AlterTable
ALTER TABLE "Solicitation" ADD COLUMN "requiresTooling" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SolicitationWorkflowStage" (
    "id" TEXT NOT NULL,
    "solicitationId" TEXT NOT NULL,
    "stage" "WorkflowStage" NOT NULL,
    "status" "WorkflowStageStatus" NOT NULL DEFAULT 'PENDING',
    "order" INTEGER NOT NULL,
    "plannedStartAt" TIMESTAMP(3),
    "plannedEndAt" TIMESTAMP(3),
    "plannedDurationPercentage" DECIMAL(5,2),
    "actualStartAt" TIMESTAMP(3),
    "actualEndAt" TIMESTAMP(3),
    "kairoTeamId" TEXT,
    "kairoCardIds" TEXT,
    "kairoSyncedAt" TIMESTAMP(3),
    "kairoSyncedByUserId" TEXT,
    "completedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitationWorkflowStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SolicitationWorkflowStage_solicitationId_stage_key" ON "SolicitationWorkflowStage"("solicitationId", "stage");

-- CreateIndex
CREATE INDEX "SolicitationWorkflowStage_stage_status_idx" ON "SolicitationWorkflowStage"("stage", "status");

-- CreateIndex
CREATE INDEX "SolicitationWorkflowStage_solicitationId_idx" ON "SolicitationWorkflowStage"("solicitationId");

-- AddForeignKey
ALTER TABLE "SolicitationWorkflowStage" ADD CONSTRAINT "SolicitationWorkflowStage_solicitationId_fkey" FOREIGN KEY ("solicitationId") REFERENCES "Solicitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitationWorkflowStage" ADD CONSTRAINT "SolicitationWorkflowStage_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitationWorkflowStage" ADD CONSTRAINT "SolicitationWorkflowStage_kairoSyncedByUserId_fkey" FOREIGN KEY ("kairoSyncedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
