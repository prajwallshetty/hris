-- CreateEnum
CREATE TYPE "WorkerType" AS ENUM ('FRL', 'HRD', 'OWN');

-- AlterTable
ALTER TABLE "TimesheetItem" ALTER COLUMN "iqamaNumber" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "supplierId" TEXT,
ADD COLUMN     "workerType" "WorkerType",
ALTER COLUMN "iqamaNumber" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_status_idx" ON "Supplier"("status");

-- CreateIndex
CREATE INDEX "Worker_workerType_idx" ON "Worker"("workerType");

-- CreateIndex
CREATE INDEX "Worker_supplierId_idx" ON "Worker"("supplierId");

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

