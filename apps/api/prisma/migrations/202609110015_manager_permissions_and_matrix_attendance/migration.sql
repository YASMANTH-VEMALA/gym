BEGIN;

-- 1. Add 'MANAGER' to AccessRole enum
ALTER TYPE "AccessRole" ADD VALUE IF NOT EXISTS 'MANAGER';

-- 2. Add assignedBranchId and permissions to BusinessAccess
ALTER TABLE "BusinessAccess" ADD COLUMN IF NOT EXISTS "assignedBranchId" UUID;
ALTER TABLE "BusinessAccess" ADD COLUMN IF NOT EXISTS "permissions" JSONB;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BusinessAccess_assignedBranchId_fkey'
  ) THEN
    ALTER TABLE "BusinessAccess" ADD CONSTRAINT "BusinessAccess_assignedBranchId_fkey"
      FOREIGN KEY ("assignedBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "BusinessAccess_businessId_assignedBranchId_idx" ON "BusinessAccess"("businessId", "assignedBranchId");

-- 3. Add assignedBranchId and permissions to Invitation
ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "assignedBranchId" UUID;
ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "permissions" JSONB;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Invitation_assignedBranchId_fkey'
  ) THEN
    ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_assignedBranchId_fkey"
      FOREIGN KEY ("assignedBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Update Attendance: make membershipId nullable, add status and session columns
ALTER TABLE "Attendance" ALTER COLUMN "membershipId" DROP NOT NULL;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL DEFAULT 'PRESENT';
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "session" VARCHAR(20);

-- 5. Add googleSheetId and googleSyncSettings to Business
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "googleSheetId" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "googleSyncSettings" JSONB;

COMMIT;
