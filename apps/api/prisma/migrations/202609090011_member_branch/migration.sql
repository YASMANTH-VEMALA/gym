BEGIN;
ALTER TABLE "Member" ADD COLUMN "branchId" UUID;
ALTER TABLE "Member" ADD CONSTRAINT "Member_businessId_branchId_fkey" FOREIGN KEY ("businessId", "branchId") REFERENCES "Branch"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Member_businessId_branchId_status_idx" ON "Member"("businessId", "branchId", "status");
COMMIT;
