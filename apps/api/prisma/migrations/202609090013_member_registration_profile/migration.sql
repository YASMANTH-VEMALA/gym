BEGIN;

ALTER TABLE "Member"
  ADD COLUMN "emergencyContacts" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "Member"
SET "emergencyContacts" = jsonb_build_array(
  jsonb_strip_nulls(jsonb_build_object(
    'name', "emergencyContactName",
    'relationship', "emergencyContactRelationship",
    'phone', "emergencyContactPhone"
  ))
)
WHERE "emergencyContactName" IS NOT NULL OR "emergencyContactPhone" IS NOT NULL;

CREATE TABLE "MemberProfilePhoto" (
  "memberId" UUID NOT NULL,
  "businessId" UUID NOT NULL,
  "contentType" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemberProfilePhoto_pkey" PRIMARY KEY ("memberId"),
  CONSTRAINT "MemberProfilePhoto_businessId_memberId_key" UNIQUE ("businessId", "memberId"),
  CONSTRAINT "MemberProfilePhoto_businessId_memberId_fkey"
    FOREIGN KEY ("businessId", "memberId") REFERENCES "Member"("businessId", "id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MemberProfilePhoto_content_type_check"
    CHECK ("contentType" IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT "MemberProfilePhoto_size_check"
    CHECK (octet_length("data") BETWEEN 1 AND 1572864)
);

ALTER TABLE "MemberProfilePhoto" ENABLE ROW LEVEL SECURITY;

COMMIT;
