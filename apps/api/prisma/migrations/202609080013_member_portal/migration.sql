BEGIN;
CREATE TABLE "MemberAccountLink" (
 id UUID PRIMARY KEY,"businessId" UUID NOT NULL,"memberId" UUID NOT NULL,"userId" UUID NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "MemberAccountLink_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "MemberAccountLink_businessId_memberId_fkey" FOREIGN KEY ("businessId","memberId") REFERENCES "Member"("businessId",id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MemberAccountLink_memberId_key" ON "MemberAccountLink"("memberId");
CREATE UNIQUE INDEX "MemberAccountLink_businessId_userId_key" ON "MemberAccountLink"("businessId","userId");
CREATE INDEX "MemberAccountLink_userId_idx" ON "MemberAccountLink"("userId");
CREATE TABLE "MemberLinkInvitation" (
 id UUID PRIMARY KEY,"businessId" UUID NOT NULL,"memberId" UUID NOT NULL,email TEXT NOT NULL,"tokenHash" TEXT NOT NULL,"invitedBy" UUID NOT NULL,"expiresAt" TIMESTAMP(3) NOT NULL,"acceptedAt" TIMESTAMP(3),"acceptedBy" UUID,"revokedAt" TIMESTAMP(3),"deliveryStatus" TEXT NOT NULL DEFAULT 'PENDING',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "MemberLinkInvitation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "MemberLinkInvitation_businessId_memberId_fkey" FOREIGN KEY ("businessId","memberId") REFERENCES "Member"("businessId",id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "MemberLinkInvitation_hash_check" CHECK ("tokenHash" ~ '^[a-f0-9]{64}$'),
 CONSTRAINT "MemberLinkInvitation_email_check" CHECK (email=lower(btrim(email))),
 CONSTRAINT "MemberLinkInvitation_accept_check" CHECK (("acceptedAt" IS NULL)=("acceptedBy" IS NULL)),
 CONSTRAINT "MemberLinkInvitation_delivery_check" CHECK ("deliveryStatus" IN ('PENDING','SENT','FAILED'))
);
CREATE UNIQUE INDEX "MemberLinkInvitation_memberId_key" ON "MemberLinkInvitation"("memberId");
CREATE UNIQUE INDEX "MemberLinkInvitation_tokenHash_key" ON "MemberLinkInvitation"("tokenHash");
CREATE INDEX "MemberLinkInvitation_businessId_createdAt_idx" ON "MemberLinkInvitation"("businessId","createdAt");
ALTER TABLE "MemberAccountLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemberLinkInvitation" ENABLE ROW LEVEL SECURITY;
COMMIT;
