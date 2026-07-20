-- CreateEnum
CREATE TYPE "OrganisationInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "OrganisationInvitation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrganisationRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "OrganisationInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "acceptedByUserId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganisationInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationInvitation_tokenHash_key" ON "OrganisationInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "OrganisationInvitation_organisationId_status_expiresAt_idx" ON "OrganisationInvitation"("organisationId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "OrganisationInvitation_email_status_expiresAt_idx" ON "OrganisationInvitation"("email", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "OrganisationInvitation_organisationId_email_idx" ON "OrganisationInvitation"("organisationId", "email");

-- AddForeignKey
ALTER TABLE "OrganisationInvitation" ADD CONSTRAINT "OrganisationInvitation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationInvitation" ADD CONSTRAINT "OrganisationInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationInvitation" ADD CONSTRAINT "OrganisationInvitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ApplicationTimeline_applicationId_isCandidateVisible_createdAt_" RENAME TO "ApplicationTimeline_applicationId_isCandidateVisible_create_idx";
