-- Normalize roles before shrinking enum
UPDATE "User" SET "role" = 'USER' WHERE "role"::text NOT IN ('USER', 'ADMIN');

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
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_managerId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "User_managerId_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN IF EXISTS "managerId";