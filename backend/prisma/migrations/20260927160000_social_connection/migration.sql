-- LinkedIn (social) connection per organisation.
CREATE TABLE "SocialConnection" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'LINKEDIN',
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "connectedAccountId" TEXT,
    "connectedName" TEXT,
    "encryptedAccessToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "scopes" JSONB,
    "metadata" JSONB,
    "connectedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialConnection_organisationId_provider_key" ON "SocialConnection"("organisationId", "provider");
CREATE INDEX "SocialConnection_organisationId_idx" ON "SocialConnection"("organisationId");

ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
