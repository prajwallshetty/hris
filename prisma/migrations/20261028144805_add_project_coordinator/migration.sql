-- AlterTable
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "coordinatorId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Project_coordinatorId_idx" ON "Project"("coordinatorId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "Coordinator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
