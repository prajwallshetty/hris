-- CreateEnum
CREATE TYPE "RecurringChargeCategory" AS ENUM ('HOUSING', 'TRANSPORT', 'MEAL', 'UTILITY', 'OTHER');

-- CreateEnum
CREATE TYPE "BillingFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "RecurringChargeStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "WorkerRecurringCharge" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "category" "RecurringChargeCategory" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "frequency" "BillingFrequency" NOT NULL DEFAULT 'MONTHLY',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "depositAmount" DECIMAL(14,2),
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecurringChargeStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerRecurringCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerRecurringChargeDeduction" (
    "id" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerRecurringChargeDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkerRecurringCharge_workerId_idx" ON "WorkerRecurringCharge"("workerId");

-- CreateIndex
CREATE INDEX "WorkerRecurringCharge_status_idx" ON "WorkerRecurringCharge"("status");

-- CreateIndex
CREATE INDEX "WorkerRecurringChargeDeduction_chargeId_idx" ON "WorkerRecurringChargeDeduction"("chargeId");

-- AddForeignKey
ALTER TABLE "WorkerRecurringCharge" ADD CONSTRAINT "WorkerRecurringCharge_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerRecurringChargeDeduction" ADD CONSTRAINT "WorkerRecurringChargeDeduction_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "WorkerRecurringCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

