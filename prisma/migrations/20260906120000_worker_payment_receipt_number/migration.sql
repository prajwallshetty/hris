-- AlterTable
ALTER TABLE "WorkerPayment" ADD COLUMN     "sequenceNo" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "WorkerPayment_sequenceNo_key" ON "WorkerPayment"("sequenceNo");
