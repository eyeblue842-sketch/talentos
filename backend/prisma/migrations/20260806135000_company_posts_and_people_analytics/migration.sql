CREATE TYPE "OrganisationPostStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "OrganisationPost" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "imageUrl" TEXT,
  "status" "OrganisationPostStatus" NOT NULL DEFAULT 'PUBLISHED',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganisationPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrganisationPost_organisationId_status_publishedAt_idx" ON "OrganisationPost"("organisationId", "status", "publishedAt");
CREATE INDEX "OrganisationPost_authorUserId_createdAt_idx" ON "OrganisationPost"("authorUserId", "createdAt");

ALTER TABLE "OrganisationPost"
  ADD CONSTRAINT "OrganisationPost_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganisationPost"
  ADD CONSTRAINT "OrganisationPost_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
