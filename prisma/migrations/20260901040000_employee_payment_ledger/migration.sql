-- AlterTable
ALTER TABLE "WorkerPayment" ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "employeePayrollId" TEXT,
ALTER COLUMN "workerId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "WorkerPayment_employeeId_idx" ON "WorkerPayment"("employeeId");

-- CreateIndex
CREATE INDEX "WorkerPayment_employeePayrollId_idx" ON "WorkerPayment"("employeePayrollId");

-- AddForeignKey
ALTER TABLE "WorkerPayment" ADD CONSTRAINT "WorkerPayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "InternalEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerPayment" ADD CONSTRAINT "WorkerPayment_employeePayrollId_fkey" FOREIGN KEY ("employeePayrollId") REFERENCES "EmployeePayroll"("id") ON DELETE SET NULL ON UPDATE CASCADE;

