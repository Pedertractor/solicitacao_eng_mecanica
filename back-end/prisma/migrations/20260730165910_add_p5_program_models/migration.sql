-- CreateEnum
CREATE TYPE "PillarCode" AS ENUM ('SAFETY', 'PRODUCTIVITY', 'QUALITY_5S', 'ABSENTEEISM', 'REVENUE');

-- CreateEnum
CREATE TYPE "IndicatorScope" AS ENUM ('INDIVIDUAL', 'SECTOR', 'COMPANY');

-- CreateEnum
CREATE TYPE "CalculationType" AS ENUM ('ZERO_OCCURRENCE', 'THRESHOLD', 'FORMULA', 'MANUAL');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('DRAFT', 'OPEN', 'CALCULATED', 'UNDER_REVIEW', 'HOMOLOGATED', 'LOCKED');

-- CreateEnum
CREATE TYPE "AccidentType" AS ENUM ('WITH_LEAVE', 'WITHOUT_LEAVE');

-- CreateEnum
CREATE TYPE "AccidentStatus" AS ENUM ('IMPORTED', 'PENDING_REVIEW', 'VALIDATED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('PROVISIONAL', 'VALIDATED', 'HOMOLOGATED');

-- CreateEnum
CREATE TYPE "SourceSystem" AS ENUM ('CIPA', 'MANUAL', 'PEDERTRACTOR');

-- CreateTable
CREATE TABLE "Sector" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "unit" "Unit" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "Unit" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "currentSectorId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramYear" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PillarConfig" (
    "id" TEXT NOT NULL,
    "programYearId" TEXT NOT NULL,
    "code" "PillarCode" NOT NULL,
    "name" TEXT NOT NULL,
    "maxPoints" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PillarConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicatorConfig" (
    "id" TEXT NOT NULL,
    "pillarId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "IndicatorScope" NOT NULL,
    "calculationType" "CalculationType" NOT NULL,
    "maxInternalPoints" DECIMAL(10,2) NOT NULL,
    "target" DECIMAL(10,2),
    "targetOperator" TEXT,
    "sourceSystem" "SourceSystem" NOT NULL,
    "ruleConfig" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndicatorConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyCycle" (
    "id" TEXT NOT NULL,
    "programYearId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'DRAFT',
    "openedAt" TIMESTAMP(3),
    "calculatedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "homologatedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleParticipant" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "employeeNameSnapshot" TEXT NOT NULL,
    "sectorNameSnapshot" TEXT NOT NULL,
    "unitSnapshot" "Unit" NOT NULL,
    "activeInCycle" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CycleParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyAccident" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "sourceSystem" "SourceSystem" NOT NULL,
    "externalId" TEXT NOT NULL,
    "employeeId" TEXT,
    "sectorId" TEXT NOT NULL,
    "accidentType" "AccidentType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "daysAway" INTEGER,
    "description" TEXT,
    "status" "AccidentStatus" NOT NULL DEFAULT 'IMPORTED',
    "rawPayload" JSONB,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyAccident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicatorResult" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "scope" "IndicatorScope" NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "sectorId" TEXT,
    "employeeId" TEXT,
    "rawValue" DECIMAL(10,2),
    "targetValue" DECIMAL(10,2),
    "preservedInternalPoints" DECIMAL(10,2) NOT NULL,
    "weightedP5Points" DECIMAL(10,2) NOT NULL,
    "status" "ResultStatus" NOT NULL DEFAULT 'PROVISIONAL',
    "calculationDetails" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndicatorResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePillarScore" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "pillarId" TEXT NOT NULL,
    "internalScore" DECIMAL(10,2) NOT NULL,
    "weightedPoints" DECIMAL(10,2) NOT NULL,
    "status" "ResultStatus" NOT NULL DEFAULT 'PROVISIONAL',
    "calculationDetails" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePillarScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeMonthlyScore" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "totalPoints" DECIMAL(10,2) NOT NULL,
    "status" "ResultStatus" NOT NULL DEFAULT 'PROVISIONAL',
    "isPartial" BOOLEAN NOT NULL DEFAULT true,
    "calculatedPillars" JSONB,
    "pendingPillars" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeMonthlyScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "P5AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "cycleId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "P5AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sector_unit_idx" ON "Sector"("unit");

-- CreateIndex
CREATE INDEX "Sector_active_idx" ON "Sector"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Sector_externalId_unit_key" ON "Sector"("externalId", "unit");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_externalId_key" ON "Employee"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeId_key" ON "Employee"("employeeId");

-- CreateIndex
CREATE INDEX "Employee_unit_idx" ON "Employee"("unit");

-- CreateIndex
CREATE INDEX "Employee_active_idx" ON "Employee"("active");

-- CreateIndex
CREATE INDEX "Employee_currentSectorId_idx" ON "Employee"("currentSectorId");

-- CreateIndex
CREATE INDEX "Employee_userId_idx" ON "Employee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramYear_year_key" ON "ProgramYear"("year");

-- CreateIndex
CREATE INDEX "PillarConfig_programYearId_idx" ON "PillarConfig"("programYearId");

-- CreateIndex
CREATE UNIQUE INDEX "PillarConfig_programYearId_code_key" ON "PillarConfig"("programYearId", "code");

-- CreateIndex
CREATE INDEX "IndicatorConfig_pillarId_idx" ON "IndicatorConfig"("pillarId");

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorConfig_pillarId_code_key" ON "IndicatorConfig"("pillarId", "code");

-- CreateIndex
CREATE INDEX "MonthlyCycle_status_idx" ON "MonthlyCycle"("status");

-- CreateIndex
CREATE INDEX "MonthlyCycle_year_month_idx" ON "MonthlyCycle"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyCycle_programYearId_year_month_key" ON "MonthlyCycle"("programYearId", "year", "month");

-- CreateIndex
CREATE INDEX "CycleParticipant_cycleId_idx" ON "CycleParticipant"("cycleId");

-- CreateIndex
CREATE INDEX "CycleParticipant_sectorId_idx" ON "CycleParticipant"("sectorId");

-- CreateIndex
CREATE UNIQUE INDEX "CycleParticipant_cycleId_employeeId_key" ON "CycleParticipant"("cycleId", "employeeId");

-- CreateIndex
CREATE INDEX "SafetyAccident_cycleId_idx" ON "SafetyAccident"("cycleId");

-- CreateIndex
CREATE INDEX "SafetyAccident_sectorId_idx" ON "SafetyAccident"("sectorId");

-- CreateIndex
CREATE INDEX "SafetyAccident_status_idx" ON "SafetyAccident"("status");

-- CreateIndex
CREATE INDEX "SafetyAccident_accidentType_idx" ON "SafetyAccident"("accidentType");

-- CreateIndex
CREATE UNIQUE INDEX "SafetyAccident_sourceSystem_externalId_key" ON "SafetyAccident"("sourceSystem", "externalId");

-- CreateIndex
CREATE INDEX "IndicatorResult_cycleId_idx" ON "IndicatorResult"("cycleId");

-- CreateIndex
CREATE INDEX "IndicatorResult_sectorId_idx" ON "IndicatorResult"("sectorId");

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorResult_cycleId_indicatorId_scope_scopeKey_key" ON "IndicatorResult"("cycleId", "indicatorId", "scope", "scopeKey");

-- CreateIndex
CREATE INDEX "EmployeePillarScore_participantId_idx" ON "EmployeePillarScore"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePillarScore_participantId_pillarId_key" ON "EmployeePillarScore"("participantId", "pillarId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMonthlyScore_participantId_key" ON "EmployeeMonthlyScore"("participantId");

-- CreateIndex
CREATE INDEX "P5AuditLog_cycleId_idx" ON "P5AuditLog"("cycleId");

-- CreateIndex
CREATE INDEX "P5AuditLog_entityType_entityId_idx" ON "P5AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "P5AuditLog_createdAt_idx" ON "P5AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_currentSectorId_fkey" FOREIGN KEY ("currentSectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PillarConfig" ADD CONSTRAINT "PillarConfig_programYearId_fkey" FOREIGN KEY ("programYearId") REFERENCES "ProgramYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorConfig" ADD CONSTRAINT "IndicatorConfig_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "PillarConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyCycle" ADD CONSTRAINT "MonthlyCycle_programYearId_fkey" FOREIGN KEY ("programYearId") REFERENCES "ProgramYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleParticipant" ADD CONSTRAINT "CycleParticipant_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "MonthlyCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleParticipant" ADD CONSTRAINT "CycleParticipant_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleParticipant" ADD CONSTRAINT "CycleParticipant_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyAccident" ADD CONSTRAINT "SafetyAccident_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "MonthlyCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyAccident" ADD CONSTRAINT "SafetyAccident_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyAccident" ADD CONSTRAINT "SafetyAccident_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyAccident" ADD CONSTRAINT "SafetyAccident_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorResult" ADD CONSTRAINT "IndicatorResult_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "MonthlyCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorResult" ADD CONSTRAINT "IndicatorResult_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "IndicatorConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorResult" ADD CONSTRAINT "IndicatorResult_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorResult" ADD CONSTRAINT "IndicatorResult_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePillarScore" ADD CONSTRAINT "EmployeePillarScore_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CycleParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePillarScore" ADD CONSTRAINT "EmployeePillarScore_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "PillarConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMonthlyScore" ADD CONSTRAINT "EmployeeMonthlyScore_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CycleParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "P5AuditLog" ADD CONSTRAINT "P5AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "P5AuditLog" ADD CONSTRAINT "P5AuditLog_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "MonthlyCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
