-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('PEDERTRACTOR', 'TRACTOR');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MANAGER', 'FINANCE', 'ADMIN', 'ACCOUNTING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "Unit" NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "costCenter" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "managerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_unit_idx" ON "User"("unit");

-- CreateIndex
CREATE INDEX "User_managerId_idx" ON "User"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_cardNumber_unit_key" ON "User"("cardNumber", "unit");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
