BEGIN;
CREATE TYPE "MembershipPlanStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TABLE "MembershipPlan" (
 "id" UUID NOT NULL,
 "businessId" UUID NOT NULL,
 "name" TEXT NOT NULL,
 "description" TEXT,
 "priceMinor" INTEGER NOT NULL,
 "durationDays" INTEGER NOT NULL,
 "appliesToAllBranches" BOOLEAN NOT NULL DEFAULT true,
 "status" "MembershipPlanStatus" NOT NULL DEFAULT 'ACTIVE',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "archivedAt" TIMESTAMP(3),
 CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "MembershipPlan_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "MembershipPlan_price_range" CHECK ("priceMinor" BETWEEN 1 AND 1000000000),
 CONSTRAINT "MembershipPlan_duration_range" CHECK ("durationDays" BETWEEN 1 AND 3650),
 CONSTRAINT "MembershipPlan_archive_state" CHECK ((status <> 'ARCHIVED' AND "archivedAt" IS NULL) OR (status = 'ARCHIVED' AND "archivedAt" IS NOT NULL))
);
CREATE TABLE "PlanBranchAssignment" (
 "planId" UUID NOT NULL,
 "branchId" UUID NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PlanBranchAssignment_pkey" PRIMARY KEY ("planId", "branchId"),
 CONSTRAINT "PlanBranchAssignment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "PlanBranchAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "MembershipPlan_businessId_status_createdAt_idx" ON "MembershipPlan"("businessId", "status", "createdAt");
CREATE INDEX "PlanBranchAssignment_branchId_planId_idx" ON "PlanBranchAssignment"("branchId", "planId");
-- All browser access must pass through the authorized NestJS API.
ALTER TABLE "MembershipPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlanBranchAssignment" ENABLE ROW LEVEL SECURITY;
COMMIT;
