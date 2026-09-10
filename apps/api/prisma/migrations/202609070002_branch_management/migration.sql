BEGIN;
CREATE TYPE "BranchStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
ALTER TABLE "Branch"
 ADD COLUMN "code" TEXT,
 ADD COLUMN "phone" TEXT,
 ADD COLUMN "email" TEXT,
 ADD COLUMN "addressLine1" TEXT,
 ADD COLUMN "addressLine2" TEXT,
 ADD COLUMN "city" TEXT,
 ADD COLUMN "state" TEXT,
 ADD COLUMN "postalCode" TEXT,
 ADD COLUMN "country" TEXT,
 ADD COLUMN "timezone" TEXT,
 ADD COLUMN "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE',
 ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ADD COLUMN "archivedAt" TIMESTAMP(3);
-- Preserve legacy/onboarding branches without inventing addresses or contacts.
WITH numbered AS (
 SELECT id, row_number() OVER (PARTITION BY "businessId" ORDER BY id) AS n FROM "Branch"
)
UPDATE "Branch" b SET code = 'BR' || lpad(n.n::text, greatest(4, length(n.n::text)), '0') FROM numbered n WHERE b.id = n.id;
ALTER TABLE "Branch" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "Branch" ALTER COLUMN "code" SET DEFAULT ('BR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));
CREATE UNIQUE INDEX "Branch_businessId_code_key" ON "Branch"("businessId", "code");
CREATE INDEX "Branch_businessId_status_createdAt_idx" ON "Branch"("businessId", "status", "createdAt");
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_code_format" CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{1,19}$');
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_archive_state" CHECK ((status = 'ACTIVE' AND "archivedAt" IS NULL) OR (status = 'ARCHIVED' AND "archivedAt" IS NOT NULL));
ALTER TABLE "AuditEvent" ADD COLUMN "metadata" JSONB;
COMMIT;
