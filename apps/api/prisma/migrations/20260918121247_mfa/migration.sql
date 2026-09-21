-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MfaSecret" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "recoveryCodes" TEXT[],
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaSecret_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MfaSecret_userId_key" ON "MfaSecret"("userId");

-- AddForeignKey
ALTER TABLE "MfaSecret" ADD CONSTRAINT "MfaSecret_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
