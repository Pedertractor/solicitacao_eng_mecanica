-- Existing production rows are engineering work.
-- Former ADMIN becomes ADMIN_ENG. Users and solicitations stay in ENG_MECANICA
-- and already-approved so current logins keep working after deploy.

CREATE TYPE "UserDepartment" AS ENUM ('ENG_MECANICA', 'DESENVOLVIMENTO_PROCESSOS');

CREATE TYPE "UserApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'ADMIN_ENG', 'ADMIN_PROCESSOS', 'USER');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "User"
ALTER COLUMN "role" TYPE "UserRole_new"
USING (
  CASE "role"::text
    WHEN 'ADMIN' THEN 'ADMIN_ENG'::"UserRole_new"
    ELSE 'USER'::"UserRole_new"
  END
);

DROP TYPE "UserRole";

ALTER TYPE "UserRole_new" RENAME TO "UserRole";

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER'::"UserRole";

ALTER TABLE "User"
ADD COLUMN "department" "UserDepartment" NOT NULL DEFAULT 'ENG_MECANICA';

ALTER TABLE "User"
ADD COLUMN "approvalStatus" "UserApprovalStatus" NOT NULL DEFAULT 'APPROVED';

ALTER TABLE "Solicitation"
ADD COLUMN "department" "UserDepartment" NOT NULL DEFAULT 'ENG_MECANICA';

CREATE INDEX "User_department_idx" ON "User"("department");

CREATE INDEX "Solicitation_department_idx" ON "Solicitation"("department");
