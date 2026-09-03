-- AlterEnum
ALTER TYPE "SolicitationStatus" ADD VALUE 'APPROVED';

-- CreateEnum
CREATE TYPE "SolicitationClient" AS ENUM (
  'CATERPILLAR',
  'CNH_CONTAGEM',
  'CNH_CURITIBA',
  'CNH_PIRACICABA',
  'CNH_SOROCABA',
  'CRUCIANELLI',
  'DYNAPAC',
  'HYUNDAI',
  'IVECO',
  'JACTO',
  'JCB',
  'JOHN_DEERE_CATALAO',
  'JOHN_DEERE_INDAIATUBA',
  'PEDERTRACTOR',
  'PRAMAC',
  'SILTOMAC',
  'TRACTOR_COMPONENTS',
  'VOLVO'
);

-- CreateEnum
CREATE TYPE "SolicitationActivityType" AS ENUM (
  'ANALISE_TECNICA',
  'DESENHO_2D',
  'DISP_ELEVACAO',
  'INSPECAO_CADASTRO',
  'LEVANTAMENTO_DE_CUSTO',
  'NR12',
  'NR13',
  'NAO_CLASSIFICADA',
  'PROJETO_INDUSTRIAL',
  'PROJETO_MELHORIA',
  'REUNIAO',
  'VALIDACAO_ESTRUTURAL'
);

-- CreateEnum
CREATE TYPE "SolicitationProductType" AS ENUM (
  'AMOSTRA',
  'PRODUCAO',
  'PROTOTIPO',
  'SEM_CLASSIFICACAO'
);

-- CreateEnum
CREATE TYPE "SolicitationPriority" AS ENUM (
  'BAIXA',
  'NORMAL',
  'SEM_CLASSIFICACAO',
  'URGENTE'
);

-- AlterTable
ALTER TABLE "Solicitation"
ADD COLUMN "client" "SolicitationClient",
ADD COLUMN "activityType" "SolicitationActivityType",
ADD COLUMN "productType" "SolicitationProductType",
ADD COLUMN "priority" "SolicitationPriority";
