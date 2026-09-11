CREATE TABLE "GoogleWorkspaceConnection" (
  "businessId" UUID NOT NULL,
  "refreshTokenEncrypted" TEXT NOT NULL,
  "accessTokenEncrypted" TEXT,
  "accessTokenExpiresAt" TIMESTAMP(3),
  "spreadsheetId" TEXT,
  "connectedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GoogleWorkspaceConnection_pkey" PRIMARY KEY ("businessId")
);

ALTER TABLE "GoogleWorkspaceConnection"
ADD CONSTRAINT "GoogleWorkspaceConnection_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
