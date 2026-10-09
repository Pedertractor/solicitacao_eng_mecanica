-- AlterEnum
ALTER TYPE "SolicitationClient" ADD VALUE 'CATERPILLAR_GERADORES';
ALTER TYPE "SolicitationClient" ADD VALUE 'JOHN_DEERE_HORIZONTINA';
ALTER TYPE "SolicitationClient" ADD VALUE 'MOTOCANA';
ALTER TYPE "SolicitationClient" ADD VALUE 'TRIVELATO';

-- AlterTable
ALTER TABLE "Solicitation"
ADD COLUMN "processInstructionRequester" TEXT,
ADD COLUMN "processInstructionProcess" TEXT,
ADD COLUMN "processInstructionType" TEXT,
ADD COLUMN "processInstructionDeadlineLabel" TEXT,
ADD COLUMN "processInstructionDeadlineDate" TEXT,
ADD COLUMN "deliveryDate" TIMESTAMP(3),
ADD COLUMN "partNumbers" TEXT,
ADD COLUMN "fileLink" TEXT;
