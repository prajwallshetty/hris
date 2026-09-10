-- AlterTable
ALTER TABLE "WorkerPayment" ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedById" TEXT;
