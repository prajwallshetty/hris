-- CreateEnum
CREATE TYPE "ImportModule" AS ENUM ('WORKER', 'TIMESHEET');

-- CreateEnum
CREATE TYPE "ImportRunStatus" AS ENUM ('COMPLETED', 'PARTIAL', 'FAILED');

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "batchNumber" TEXT;

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "module" "ImportModule" NOT NULL,
    "status" "ImportRunStatus" NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "importedRows" INTEGER NOT NULL,
    "failedRows" INTEGER NOT NULL,
    "errorReport" JSONB,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportRun_module_idx" ON "ImportRun"("module");

-- CreateIndex
CREATE INDEX "ImportRun_createdAt_idx" ON "ImportRun"("createdAt");

-- CreateIndex
CREATE INDEX "Worker_batchNumber_idx" ON "Worker"("batchNumber");

-- CreateIndex
CREATE INDEX "WorkerPayment_voidedAt_idx" ON "WorkerPayment"("voidedAt");

-- AddForeignKey
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
