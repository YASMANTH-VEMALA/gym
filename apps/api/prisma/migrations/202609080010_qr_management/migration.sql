BEGIN;
CREATE TYPE "QrKind" AS ENUM ('MEMBER','BRANCH');
CREATE TYPE "QrStatus" AS ENUM ('ACTIVE','REVOKED');
CREATE UNIQUE INDEX "Branch_businessId_id_key" ON "Branch"("businessId",id);
CREATE UNIQUE INDEX "Member_businessId_id_key" ON "Member"("businessId",id);
CREATE TABLE "QrCredential" (
 id UUID PRIMARY KEY,"businessId" UUID NOT NULL,kind "QrKind" NOT NULL,
 "memberId" UUID,"branchId" UUID,"tokenHash" TEXT NOT NULL,"encryptedToken" TEXT,
 status "QrStatus" NOT NULL DEFAULT 'ACTIVE',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"rotatedAt" TIMESTAMP(3),"revokedAt" TIMESTAMP(3),
 CONSTRAINT "QrCredential_target_check" CHECK ((kind='MEMBER' AND "memberId" IS NOT NULL AND "branchId" IS NULL) OR (kind='BRANCH' AND "branchId" IS NOT NULL AND "memberId" IS NULL)),
 CONSTRAINT "QrCredential_state_check" CHECK ((status='ACTIVE' AND "encryptedToken" IS NOT NULL AND "revokedAt" IS NULL) OR (status='REVOKED' AND "encryptedToken" IS NULL AND "revokedAt" IS NOT NULL)),
 CONSTRAINT "QrCredential_hash_check" CHECK ("tokenHash" ~ '^[a-f0-9]{64}$'),
 CONSTRAINT "QrCredential_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "QrCredential_businessId_memberId_fkey" FOREIGN KEY ("businessId","memberId") REFERENCES "Member"("businessId",id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "QrCredential_businessId_branchId_fkey" FOREIGN KEY ("businessId","branchId") REFERENCES "Branch"("businessId",id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "QrCredential_memberId_key" ON "QrCredential"("memberId");
CREATE UNIQUE INDEX "QrCredential_branchId_key" ON "QrCredential"("branchId");
CREATE UNIQUE INDEX "QrCredential_tokenHash_key" ON "QrCredential"("tokenHash");
CREATE INDEX "QrCredential_businessId_kind_status_idx" ON "QrCredential"("businessId",kind,status);
ALTER TABLE "QrCredential" ENABLE ROW LEVEL SECURITY;
COMMIT;
