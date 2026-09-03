-- CreateTable
CREATE TABLE "UserKairoCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastValidatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserKairoCredential_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Solicitation" ADD COLUMN     "kairoCardId" TEXT,
ADD COLUMN     "kairoTeamId" TEXT,
ADD COLUMN     "kairoSyncedAt" TIMESTAMP(3),
ADD COLUMN     "kairoSyncedByUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserKairoCredential_userId_key" ON "UserKairoCredential"("userId");

-- AddForeignKey
ALTER TABLE "UserKairoCredential" ADD CONSTRAINT "UserKairoCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitation" ADD CONSTRAINT "Solicitation_kairoSyncedByUserId_fkey" FOREIGN KEY ("kairoSyncedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
