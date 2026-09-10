BEGIN;
CREATE TABLE "Membership" (
 "id" UUID PRIMARY KEY, "businessId" UUID NOT NULL, "memberId" UUID NOT NULL, "branchId" UUID NOT NULL, "planId" UUID NOT NULL,
 "planNameSnapshot" TEXT NOT NULL, "priceMinorSnapshot" INTEGER NOT NULL CHECK ("priceMinorSnapshot" BETWEEN 1 AND 1000000000),
 "durationDaysSnapshot" INTEGER NOT NULL CHECK ("durationDaysSnapshot" BETWEEN 1 AND 3650),
 "startDate" DATE NOT NULL, "endDate" DATE NOT NULL, "cancelledAt" TIMESTAMP(3), "cancelReason" TEXT,
 "idempotencyKey" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Membership_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "Membership_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "Membership_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "Membership_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "Membership_dates" CHECK ("endDate" = "startDate" + "durationDaysSnapshot" - 1),
 CONSTRAINT "Membership_cancellation" CHECK (("cancelledAt" IS NULL AND "cancelReason" IS NULL) OR ("cancelledAt" IS NOT NULL AND length("cancelReason") > 0))
);
CREATE UNIQUE INDEX "Membership_businessId_idempotencyKey_key" ON "Membership"("businessId","idempotencyKey");
CREATE INDEX "Membership_businessId_branchId_startDate_endDate_idx" ON "Membership"("businessId","branchId","startDate","endDate");
CREATE INDEX "Membership_memberId_startDate_idx" ON "Membership"("memberId","startDate");
ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
COMMIT;
