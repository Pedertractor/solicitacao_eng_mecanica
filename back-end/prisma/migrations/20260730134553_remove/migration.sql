/*
  Warnings:

  - The values [MANAGER,FINANCE,ACCOUNTING] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `managerId` on the `User` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('USER', 'ADMIN');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_managerId_fkey";

-- DropIndex
DROP INDEX "User_managerId_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "managerId";
