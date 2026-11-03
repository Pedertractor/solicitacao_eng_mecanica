-- Preserve operational permissions while separating role from department.
BEGIN;
CREATE TYPE "UserDepartment_new" AS ENUM ('ENG_MECANICA', 'DESENVOLVIMENTO_PROCESSOS', 'FERRAMENTARIA', 'QUALIDADE', 'AMOSTRA', 'COMERCIAL', 'PCP');
ALTER TABLE "User" ALTER COLUMN "department" DROP DEFAULT;
ALTER TABLE "Solicitation" ALTER COLUMN "department" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "department" TYPE "UserDepartment_new" USING (CASE WHEN "role"::text IN ('PCP', 'COMERCIAL') THEN "role"::text ELSE "department"::text END)::"UserDepartment_new";
ALTER TABLE "Solicitation" ALTER COLUMN "department" TYPE "UserDepartment_new" USING "department"::text::"UserDepartment_new";
DROP TYPE "UserDepartment";
ALTER TYPE "UserDepartment_new" RENAME TO "UserDepartment";
ALTER TABLE "User" ALTER COLUMN "department" SET DEFAULT 'ENG_MECANICA';
ALTER TABLE "Solicitation" ALTER COLUMN "department" SET DEFAULT 'ENG_MECANICA';
UPDATE "User" SET "role" = 'ADMIN', "updatedAt" = CURRENT_TIMESTAMP WHERE "role"::text IN ('PCP', 'COMERCIAL');
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING "role"::text::"UserRole_new";
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;
