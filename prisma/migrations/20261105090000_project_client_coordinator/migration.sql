-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "coordinatorId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "coordinatorId" TEXT;

-- CreateIndex
CREATE INDEX "Project_coordinatorId_idx" ON "Project"("coordinatorId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "Coordinator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "Coordinator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

