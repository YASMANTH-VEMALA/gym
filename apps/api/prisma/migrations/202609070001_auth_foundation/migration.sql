-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccessRole" AS ENUM ('OWNER', 'ADMIN');

-- CreateTable
CREATE TABLE "Business" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessAccess" (
    "businessId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "AccessRole" NOT NULL,

    CONSTRAINT "BusinessAccess_pkey" PRIMARY KEY ("businessId","userId")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "AccessRole" NOT NULL DEFAULT 'ADMIN',
    "tokenHash" TEXT NOT NULL,
    "invitedBy" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" UUID,
    "revokedAt" TIMESTAMP(3),
    "deliveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Business_ownerId_key" ON "Business"("ownerId");

-- CreateIndex
CREATE INDEX "BusinessAccess_userId_idx" ON "BusinessAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_businessId_createdAt_idx" ON "Invitation"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_businessId_createdAt_idx" ON "AuditEvent"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessAccess" ADD CONSTRAINT "BusinessAccess_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Browser clients must use the authorized NestJS API, never PostgREST tables.
ALTER TABLE "Business" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Branch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BusinessAccess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_hash_format" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_admin_role" CHECK ("role" = 'ADMIN');
