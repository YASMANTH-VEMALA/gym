BEGIN;

ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;

CREATE TABLE IF NOT EXISTS "BusinessLogo" (
  "businessId" UUID NOT NULL,
  "contentType" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "byteLength" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessLogo_pkey" PRIMARY KEY ("businessId"),
  CONSTRAINT "BusinessLogo_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BusinessLogo_content_type_check"
    CHECK ("contentType" IN ('image/jpeg', 'image/png', 'image/webp', 'image/svg+xml')),
  CONSTRAINT "BusinessLogo_size_check"
    CHECK ("byteLength" BETWEEN 1 AND 2097152 AND octet_length("data") = "byteLength")
);

ALTER TABLE "BusinessLogo" ENABLE ROW LEVEL SECURITY;

COMMIT;
