ALTER TYPE "WorkflowStageStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TABLE "SolicitationWorkflowStage" ADD COLUMN "rejectionReason" TEXT, ADD COLUMN "rejectedAt" TIMESTAMP(3), ADD COLUMN "rejectedByUserId" TEXT, ADD COLUMN "rejectedByName" TEXT;
