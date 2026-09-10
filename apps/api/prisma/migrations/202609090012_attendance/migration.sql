BEGIN;
CREATE TABLE "Attendance" (
 "id" UUID PRIMARY KEY,
 "businessId" UUID NOT NULL,
 "branchId" UUID NOT NULL,
 "memberId" UUID NOT NULL,
 "membershipId" UUID NOT NULL,
 "attendanceDate" DATE NOT NULL,
 "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "checkedOutAt" TIMESTAMP(3),
 "recordedByUserId" UUID NOT NULL,
 CONSTRAINT "Attendance_businessId_branchId_fkey" FOREIGN KEY ("businessId","branchId") REFERENCES "Branch"("businessId","id") ON UPDATE CASCADE,
 CONSTRAINT "Attendance_businessId_memberId_fkey" FOREIGN KEY ("businessId","memberId") REFERENCES "Member"("businessId","id") ON UPDATE CASCADE,
 CONSTRAINT "Attendance_businessId_membershipId_fkey" FOREIGN KEY ("businessId","membershipId") REFERENCES "Membership"("businessId","id") ON UPDATE CASCADE,
 CONSTRAINT "Attendance_checkout_check" CHECK ("checkedOutAt" IS NULL OR "checkedOutAt">="checkedInAt")
);
CREATE UNIQUE INDEX "Attendance_businessId_branchId_memberId_attendanceDate_key" ON "Attendance"("businessId","branchId","memberId","attendanceDate");
CREATE INDEX "Attendance_businessId_branchId_attendanceDate_idx" ON "Attendance"("businessId","branchId","attendanceDate");
ALTER TABLE "Attendance" ENABLE ROW LEVEL SECURITY;
COMMIT;
