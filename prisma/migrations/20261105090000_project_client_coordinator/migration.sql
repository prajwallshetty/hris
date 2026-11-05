-- Adds the client-level default coordinator (the fallback when a project has
-- none). Project.coordinatorId is added by 20261028144805_add_project_coordinator.
-- Idempotent, like that migration, so it is safe on a database where an
-- earlier form of this migration already ran.

-- AlterTable
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "coordinatorId" TEXT;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Client" ADD CONSTRAINT "Client_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "Coordinator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Project.coordinatorId, its index and foreign key are guaranteed here too, in
-- case this migration is applied to a database that skipped the earlier one.
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "coordinatorId" TEXT;
CREATE INDEX IF NOT EXISTS "Project_coordinatorId_idx" ON "Project"("coordinatorId");
DO $$ BEGIN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "Coordinator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
