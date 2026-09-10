BEGIN;
CREATE TYPE "PaymentMethod" AS ENUM ('CASH','UPI','BANK_TRANSFER','CARD','OTHER');
CREATE TYPE "PaymentStatus" AS ENUM ('RECORDED','VOID');
CREATE UNIQUE INDEX "Membership_businessId_id_key" ON "Membership"("businessId",id);
CREATE TABLE "Receivable" (
 id UUID PRIMARY KEY, "businessId" UUID NOT NULL, "membershipId" UUID NOT NULL,
 "originalAmountMinor" INTEGER NOT NULL CHECK ("originalAmountMinor" BETWEEN 1 AND 1000000000),
 "dueDate" DATE NOT NULL, "promiseToPayDate" DATE, "voidedAt" TIMESTAMP(3), "voidReason" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Receivable_businessId_membershipId_fkey" FOREIGN KEY ("businessId","membershipId") REFERENCES "Membership"("businessId",id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Receivable_membershipId_key" ON "Receivable"("membershipId");
CREATE UNIQUE INDEX "Receivable_businessId_membershipId_key" ON "Receivable"("businessId","membershipId");
CREATE UNIQUE INDEX "Receivable_businessId_id_key" ON "Receivable"("businessId",id);
CREATE INDEX "Receivable_businessId_dueDate_idx" ON "Receivable"("businessId","dueDate");
CREATE TABLE "Payment" (
 id UUID PRIMARY KEY, "businessId" UUID NOT NULL, "receivableId" UUID NOT NULL,
 "amountMinor" INTEGER NOT NULL CHECK ("amountMinor" BETWEEN 1 AND 1000000000), method "PaymentMethod" NOT NULL,
 reference TEXT, notes TEXT, "paidAt" DATE NOT NULL, "recordedByUserId" UUID NOT NULL,
 "idempotencyKey" UUID NOT NULL, status "PaymentStatus" NOT NULL DEFAULT 'RECORDED',
 "voidedAt" TIMESTAMP(3), "voidReason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Payment_businessId_receivableId_fkey" FOREIGN KEY ("businessId","receivableId") REFERENCES "Receivable"("businessId",id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "Payment_void_state" CHECK ((status='VOID' AND "voidedAt" IS NOT NULL AND length("voidReason")>0) OR (status='RECORDED' AND "voidedAt" IS NULL AND "voidReason" IS NULL))
);
CREATE UNIQUE INDEX "Payment_businessId_idempotencyKey_key" ON "Payment"("businessId","idempotencyKey");
CREATE INDEX "Payment_businessId_paidAt_status_idx" ON "Payment"("businessId","paidAt",status);
CREATE INDEX "Payment_receivableId_status_idx" ON "Payment"("receivableId",status);
INSERT INTO "Receivable" (id,"businessId","membershipId","originalAmountMinor","dueDate") SELECT gen_random_uuid(),"businessId",id,"priceMinorSnapshot","startDate" FROM "Membership";
ALTER TABLE "Receivable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
COMMIT;
