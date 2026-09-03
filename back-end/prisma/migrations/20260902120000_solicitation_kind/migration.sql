-- CreateEnum
CREATE TYPE "SolicitationKind" AS ENUM ('PROJETO', 'ATIVIDADE');

-- AlterTable
ALTER TABLE "Solicitation" ADD COLUMN "kind" "SolicitationKind";
