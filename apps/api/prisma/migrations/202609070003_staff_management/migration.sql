BEGIN;
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TABLE "Staff" (
  "id" UUID NOT NULL,
  "businessId" UUID NOT NULL,
  "fullName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "jobTitle" TEXT NOT NULL,
  "gender" TEXT,
  "dateOfBirth" DATE,
  "joiningDate" DATE NOT NULL,
  "address" TEXT,
  "emergencyContactName" TEXT,
  "emergencyContactPhone" TEXT,
  "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "Staff_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Staff_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Staff_archive_state" CHECK ((status <> 'ARCHIVED' AND "archivedAt" IS NULL) OR (status = 'ARCHIVED' AND "archivedAt" IS NOT NULL))
);
CREATE TABLE "StaffBranchAssignment" (
  "staffId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffBranchAssignment_pkey" PRIMARY KEY ("staffId", "branchId"),
  CONSTRAINT "StaffBranchAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StaffBranchAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Staff_businessId_status_createdAt_idx" ON "Staff"("businessId", "status", "createdAt");
CREATE INDEX "Staff_businessId_jobTitle_idx" ON "Staff"("businessId", "jobTitle");
CREATE INDEX "StaffBranchAssignment_branchId_staffId_idx" ON "StaffBranchAssignment"("branchId", "staffId");
COMMIT;
