-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ImportModule" AS ENUM ('WORKER', 'TIMESHEET');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ImportRunStatus" AS ENUM ('COMPLETED', 'PARTIAL', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "batchNumber" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ImportRun" (
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
CREATE INDEX IF NOT EXISTS "ImportRun_module_idx" ON "ImportRun"("module");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImportRun_createdAt_idx" ON "ImportRun"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Worker_batchNumber_idx" ON "Worker"("batchNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkerPayment_voidedAt_idx" ON "WorkerPayment"("voidedAt");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
