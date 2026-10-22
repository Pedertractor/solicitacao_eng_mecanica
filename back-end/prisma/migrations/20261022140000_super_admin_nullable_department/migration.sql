-- Super admins have no department; column becomes nullable for that role only.
ALTER TABLE "User" ALTER COLUMN "department" DROP NOT NULL;

UPDATE "User" SET "department" = NULL WHERE "role" = 'SUPER_ADMIN';
