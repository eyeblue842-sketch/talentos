-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'CHANGES_REQUESTED', 'APPROVED', 'RELEASED', 'VIEWED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'SUPERSEDED', 'JOINING_CONFIRMED', 'JOINED', 'NO_SHOW', 'DEFERRED');

-- CreateEnum
CREATE TYPE "OfferApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OfferActorType" AS ENUM ('RECRUITER', 'CANDIDATE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OfferCommentVisibility" AS ENUM ('INTERNAL', 'CANDIDATE');

-- CreateEnum
CREATE TYPE "OfferComponentFrequency" AS ENUM ('ANNUAL', 'MONTHLY', 'ONE_TIME', 'OTHER');

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "previousOfferId" TEXT,
    "supersededByOfferId" TEXT,
    "referenceNumber" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL,
    "annualCompensation" DECIMAL(14,2),
    "fixedCompensation" DECIMAL(14,2),
    "variableCompensation" DECIMAL(14,2),
    "joiningBonus" DECIMAL(14,2),
    "retentionBonus" DECIMAL(14,2),
    "allowancesAmount" DECIMAL(14,2),
    "otherCompensation" DECIMAL(14,2),
    "totalCompensation" DECIMAL(14,2),
    "benefitsSummary" TEXT,
    "compensationNotes" TEXT,
    "proposedJoiningDate" TIMESTAMP(3),
    "actualJoiningDate" TIMESTAMP(3),
    "probationPeriodMonths" INTEGER,
    "noticeOrBuyoutNote" TEXT,
    "workMode" "WorkplaceType",
    "workLocation" TEXT,
    "reportingManagerName" TEXT,
    "departmentSnapshot" TEXT,
    "employmentTypeSnapshot" "EmploymentType",
    "recruiterNameSnapshot" TEXT,
    "hiringManagerNameSnapshot" TEXT,
    "offerExpiryDays" INTEGER,
    "expiryAt" TIMESTAMP(3),
    "approvalRequestedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "joiningConfirmedAt" TIMESTAMP(3),
    "deferredAt" TIMESTAMP(3),
    "noShowAt" TIMESTAMP(3),
    "revisionReason" TEXT,
    "candidateResponseReason" TEXT,
    "withdrawalReason" TEXT,
    "deferredReason" TEXT,
    "noShowReason" TEXT,
    "termsAndConditions" TEXT,
    "internalNotes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "releasedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferComponent" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "frequency" "OfferComponentFrequency" NOT NULL DEFAULT 'ONE_TIME',
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferApproval" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "OfferApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "actedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferAccessToken" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferComment" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorType" "OfferActorType" NOT NULL,
    "visibility" "OfferCommentVisibility" NOT NULL DEFAULT 'INTERNAL',
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Offer_referenceNumber_key" ON "Offer"("referenceNumber");

-- CreateIndex
CREATE INDEX "Offer_organisationId_status_updatedAt_idx" ON "Offer"("organisationId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Offer_organisationId_expiryAt_status_idx" ON "Offer"("organisationId", "expiryAt", "status");

-- CreateIndex
CREATE INDEX "Offer_candidateId_status_updatedAt_idx" ON "Offer"("candidateId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Offer_applicationId_status_version_idx" ON "Offer"("applicationId", "status", "version");

-- CreateIndex
CREATE INDEX "Offer_jobId_status_updatedAt_idx" ON "Offer"("jobId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_applicationId_version_key" ON "Offer"("applicationId", "version");

-- CreateIndex
CREATE INDEX "OfferComponent_offerId_displayOrder_idx" ON "OfferComponent"("offerId", "displayOrder");

-- CreateIndex
CREATE INDEX "OfferApproval_approverUserId_status_createdAt_idx" ON "OfferApproval"("approverUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OfferApproval_offerId_status_sequence_idx" ON "OfferApproval"("offerId", "status", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "OfferApproval_offerId_sequence_key" ON "OfferApproval"("offerId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "OfferApproval_offerId_approverUserId_key" ON "OfferApproval"("offerId", "approverUserId");

-- CreateIndex
CREATE UNIQUE INDEX "OfferAccessToken_tokenHash_key" ON "OfferAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "OfferAccessToken_offerId_expiresAt_idx" ON "OfferAccessToken"("offerId", "expiresAt");

-- CreateIndex
CREATE INDEX "OfferAccessToken_offerId_revokedAt_consumedAt_idx" ON "OfferAccessToken"("offerId", "revokedAt", "consumedAt");

-- CreateIndex
CREATE INDEX "OfferComment_offerId_visibility_createdAt_idx" ON "OfferComment"("offerId", "visibility", "createdAt");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_previousOfferId_fkey" FOREIGN KEY ("previousOfferId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_supersededByOfferId_fkey" FOREIGN KEY ("supersededByOfferId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_releasedByUserId_fkey" FOREIGN KEY ("releasedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferComponent" ADD CONSTRAINT "OfferComponent_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferApproval" ADD CONSTRAINT "OfferApproval_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferApproval" ADD CONSTRAINT "OfferApproval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferAccessToken" ADD CONSTRAINT "OfferAccessToken_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferComment" ADD CONSTRAINT "OfferComment_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferComment" ADD CONSTRAINT "OfferComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
