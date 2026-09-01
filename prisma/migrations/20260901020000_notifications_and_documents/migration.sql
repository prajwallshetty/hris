-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "iqamaExpiryDate" TIMESTAMP(3),
ADD COLUMN     "passportExpiryDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WorkerDocument" ADD COLUMN     "documentType" TEXT,
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "verificationStatus" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT;

-- CreateIndex
CREATE INDEX "WorkerDocument_expiryDate_idx" ON "WorkerDocument"("expiryDate");

