BEGIN;
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TABLE "MemberCounter" (
 "businessId" UUID NOT NULL PRIMARY KEY,
 "lastNumber" INTEGER NOT NULL DEFAULT 0 CHECK ("lastNumber" >= 0),
 CONSTRAINT "MemberCounter_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "Member" (
 "id" UUID NOT NULL PRIMARY KEY,
 "businessId" UUID NOT NULL,
 "memberNumber" TEXT NOT NULL,
 "fullName" TEXT NOT NULL,
 "phone" TEXT NOT NULL,
 "currentPhone" TEXT,
 "alternatePhone" TEXT,
 "email" TEXT,
 "gender" TEXT,
 "dateOfBirth" DATE,
 "occupation" TEXT,
 "addressLine1" TEXT,
 "addressLine2" TEXT,
 "city" TEXT,
 "state" TEXT,
 "postalCode" TEXT,
 "country" TEXT,
 "emergencyContactName" TEXT,
 "emergencyContactRelationship" TEXT,
 "emergencyContactPhone" TEXT,
 "heightCm" INTEGER CHECK ("heightCm" BETWEEN 1 AND 300),
 "weightGrams" INTEGER CHECK ("weightGrams" BETWEEN 1 AND 1000000),
 "fitnessGoal" TEXT,
 "notes" TEXT,
 "joiningDate" DATE NOT NULL,
 "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "archivedAt" TIMESTAMP(3),
 CONSTRAINT "Member_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "Member_current_phone_state" CHECK ((status = 'ARCHIVED' AND "currentPhone" IS NULL AND "archivedAt" IS NOT NULL) OR (status <> 'ARCHIVED' AND "currentPhone" IS NOT NULL AND "currentPhone" = phone AND "archivedAt" IS NULL)),
 CONSTRAINT "Member_phone_format" CHECK (phone ~ '^\+?[0-9]{6,15}$')
);
CREATE UNIQUE INDEX "Member_businessId_memberNumber_key" ON "Member"("businessId", "memberNumber");
-- NULL keys free archived phone numbers without dropping historical records.
CREATE UNIQUE INDEX "Member_businessId_currentPhone_key" ON "Member"("businessId", "currentPhone");
CREATE INDEX "Member_businessId_status_createdAt_idx" ON "Member"("businessId", "status", "createdAt");
ALTER TABLE "Member" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemberCounter" ENABLE ROW LEVEL SECURITY;
COMMIT;
