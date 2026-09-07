-- AlterTable
ALTER TABLE "WorkerPayment" ADD COLUMN "receiptNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WorkerPayment_receiptNumber_key" ON "WorkerPayment"("receiptNumber");

-- CreateIndex
CREATE INDEX "WorkerPayment_receiptNumber_idx" ON "WorkerPayment"("receiptNumber");
