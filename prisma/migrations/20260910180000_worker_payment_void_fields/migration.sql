-- AlterTable
ALTER TABLE "WorkerPayment" ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedById" TEXT;

-- CreateIndex
CREATE INDEX "WorkerPayment_voidedAt_idx" ON "WorkerPayment"("voidedAt");
