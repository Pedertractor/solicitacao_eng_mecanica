-- AlterEnum
ALTER TYPE "SolicitationStatus" ADD VALUE 'DELETED';

-- CreateEnum
CREATE TYPE "SolicitationDeletionSource" AS ENUM ('SOLICITATION_APP', 'KAIRO');

-- AlterTable
ALTER TABLE "Solicitation" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Solicitation" ADD COLUMN "deletedByUserId" TEXT;
ALTER TABLE "Solicitation" ADD COLUMN "deletedByName" TEXT;
ALTER TABLE "Solicitation" ADD COLUMN "deletedFrom" "SolicitationDeletionSource";

-- CreateIndex
CREATE INDEX "Solicitation_deletedAt_idx" ON "Solicitation"("deletedAt");

-- AddForeignKey
ALTER TABLE "Solicitation" ADD CONSTRAINT "Solicitation_deletedByUserId_fkey" FOREIGN KEY ("deletedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
