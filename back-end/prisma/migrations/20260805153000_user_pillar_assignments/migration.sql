-- CreateTable
CREATE TABLE "UserPillarAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pillarCode" "PillarCode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPillarAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPillarAssignment_userId_idx" ON "UserPillarAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserPillarAssignment_pillarCode_idx" ON "UserPillarAssignment"("pillarCode");

-- CreateIndex
CREATE UNIQUE INDEX "UserPillarAssignment_userId_pillarCode_key" ON "UserPillarAssignment"("userId", "pillarCode");

-- AddForeignKey
ALTER TABLE "UserPillarAssignment" ADD CONSTRAINT "UserPillarAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
