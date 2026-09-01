-- CreateIndex
CREATE INDEX "Timesheet_clientId_idx" ON "Timesheet"("clientId");

-- CreateIndex
CREATE INDEX "TimesheetItem_date_idx" ON "TimesheetItem"("date");

-- CreateIndex
CREATE INDEX "TimesheetItem_status_date_idx" ON "TimesheetItem"("status", "date");

