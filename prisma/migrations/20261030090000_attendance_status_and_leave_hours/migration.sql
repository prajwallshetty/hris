-- CreateEnum
CREATE TYPE "WorkerAttendanceStatus" AS ENUM ('PRESENT', 'HALF_DAY', 'ABSENT', 'SICK_LEAVE', 'ANNUAL_LEAVE', 'UNPAID_LEAVE', 'OTHER_LEAVE', 'PUBLIC_HOLIDAY', 'WEEKLY_OFF');

-- AlterTable
ALTER TABLE "TimesheetItem" ADD COLUMN     "annualLeaveHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
ADD COLUMN     "attendanceStatus" "WorkerAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
ADD COLUMN     "otherLeaveHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
ADD COLUMN     "otherLeaveTypeId" TEXT,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "scheduledHours" DECIMAL(4,2) NOT NULL DEFAULT 8,
ADD COLUMN     "sickLeaveHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unpaidLeaveHours" DECIMAL(6,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "TimesheetItem_attendanceStatus_idx" ON "TimesheetItem"("attendanceStatus");

-- AddForeignKey
ALTER TABLE "TimesheetItem" ADD CONSTRAINT "TimesheetItem_otherLeaveTypeId_fkey" FOREIGN KEY ("otherLeaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Existing rows are worked days (every one has check-in/out), so they keep
-- the PRESENT default and zero leave. Record each one's standard day length
-- from the active overtime rule so leave-hours-to-days stays consistent.
UPDATE "TimesheetItem"
SET "scheduledHours" = r."dailyRegularHoursThreshold"
FROM (
  SELECT "dailyRegularHoursThreshold" FROM "OvertimeRule"
  WHERE "status" = 'ACTIVE' ORDER BY "effectiveFrom" DESC LIMIT 1
) AS r;

-- Rejections used to write their reason into "remarks"; copy it to the new
-- reviewer-note column (remarks are kept as they were).
UPDATE "TimesheetItem" SET "reviewNote" = "remarks"
WHERE "status" = 'REJECTED' AND "remarks" IS NOT NULL;
