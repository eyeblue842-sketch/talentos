-- CreateEnum
CREATE TYPE "CandidateProfileSource" AS ENUM ('DIRECT_SIGNUP', 'GOOGLE_OAUTH', 'BULK_IMPORT', 'RECRUITER_CREATED', 'ADMIN_CREATED');

-- CreateEnum
CREATE TYPE "CandidateProfileStatus" AS ENUM ('IMPORTED', 'REVIEW_REQUIRED', 'INVITED', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ResumeImportBatchStatus" AS ENUM ('QUEUED', 'UPLOADING', 'UPLOADED', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResumeImportItemStatus" AS ENUM ('QUEUED', 'UPLOADING', 'UPLOADED', 'EXTRACTING', 'PARSING', 'REVIEW_REQUIRED', 'DUPLICATE', 'READY', 'IMPORTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResumeImportDuplicateResolution" AS ENUM ('PENDING', 'SKIPPED', 'ATTACHED_TO_EXISTING', 'UPDATE_EMPTY_FIELDS', 'REPLACE_SELECTED_FIELDS', 'CREATED_SEPARATE', 'REJECTED');

-- AlterEnum
ALTER TYPE "BackgroundTaskType" ADD VALUE 'RESUME_IMPORT_PROCESSING';

-- DropForeignKey
ALTER TABLE "CandidateProfile" DROP CONSTRAINT "CandidateProfile_userId_fkey";

-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "cloudPlatforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "consentMetadata" JSONB,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "currentCity" TEXT,
ADD COLUMN     "currentCountry" TEXT,
ADD COLUMN     "currentState" TEXT,
ADD COLUMN     "databases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "email" TEXT,
ADD COLUMN     "frameworks" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "functionalSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "importBatchId" TEXT,
ADD COLUMN     "importedAt" TIMESTAMP(3),
ADD COLUMN     "importedByUserId" TEXT,
ADD COLUMN     "invitationSentAt" TIMESTAMP(3),
ADD COLUMN     "invitedAt" TIMESTAMP(3),
ADD COLUMN     "linkedInUrlNormalized" TEXT,
ADD COLUMN     "normalizedPhoneNumber" TEXT,
ADD COLUMN     "organisationId" TEXT,
ADD COLUMN     "parserMetadata" JSONB,
ADD COLUMN     "parserVersion" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "profileCompletenessScore" INTEGER,
ADD COLUMN     "profileStatus" "CandidateProfileStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "provenanceMetadata" JSONB,
ADD COLUMN     "rawResumeText" TEXT,
ADD COLUMN     "softSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "source" "CandidateProfileSource" NOT NULL DEFAULT 'DIRECT_SIGNUP',
ADD COLUMN     "tools" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ResumeImportBatch" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "originalFileCount" INTEGER NOT NULL DEFAULT 0,
    "totalItemCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ResumeImportBatchStatus" NOT NULL DEFAULT 'QUEUED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeImportItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "sanitizedFilename" TEXT NOT NULL,
    "storedObjectKey" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileExtension" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT,
    "status" "ResumeImportItemStatus" NOT NULL DEFAULT 'QUEUED',
    "extractedText" TEXT,
    "parsedData" JSONB,
    "parserVersion" TEXT,
    "parsingConfidence" JSONB,
    "duplicateCandidateId" TEXT,
    "duplicateReason" TEXT,
    "duplicateMatchFields" JSONB,
    "duplicateResolution" "ResumeImportDuplicateResolution" NOT NULL DEFAULT 'PENDING',
    "candidateId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "requiresManualReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewNotes" TEXT,
    "processingStartedAt" TIMESTAMP(3),
    "processingCompletedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeImportItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResumeImportBatch_organisationId_status_createdAt_idx" ON "ResumeImportBatch"("organisationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ResumeImportBatch_createdByUserId_createdAt_idx" ON "ResumeImportBatch"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ResumeImportItem_batchId_status_createdAt_idx" ON "ResumeImportItem"("batchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ResumeImportItem_organisationId_status_createdAt_idx" ON "ResumeImportItem"("organisationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ResumeImportItem_duplicateCandidateId_idx" ON "ResumeImportItem"("duplicateCandidateId");

-- CreateIndex
CREATE INDEX "ResumeImportItem_candidateId_idx" ON "ResumeImportItem"("candidateId");

-- CreateIndex
CREATE INDEX "ResumeImportItem_checksumSha256_idx" ON "ResumeImportItem"("checksumSha256");

-- CreateIndex
CREATE INDEX "CandidateProfile_organisationId_profileStatus_createdAt_idx" ON "CandidateProfile"("organisationId", "profileStatus", "createdAt");

-- CreateIndex
CREATE INDEX "CandidateProfile_organisationId_source_createdAt_idx" ON "CandidateProfile"("organisationId", "source", "createdAt");

-- CreateIndex
CREATE INDEX "CandidateProfile_email_idx" ON "CandidateProfile"("email");

-- CreateIndex
CREATE INDEX "CandidateProfile_normalizedPhoneNumber_idx" ON "CandidateProfile"("normalizedPhoneNumber");

-- CreateIndex
CREATE INDEX "CandidateProfile_linkedInUrlNormalized_idx" ON "CandidateProfile"("linkedInUrlNormalized");

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ResumeImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_importedByUserId_fkey" FOREIGN KEY ("importedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeImportBatch" ADD CONSTRAINT "ResumeImportBatch_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeImportBatch" ADD CONSTRAINT "ResumeImportBatch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeImportItem" ADD CONSTRAINT "ResumeImportItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ResumeImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeImportItem" ADD CONSTRAINT "ResumeImportItem_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeImportItem" ADD CONSTRAINT "ResumeImportItem_duplicateCandidateId_fkey" FOREIGN KEY ("duplicateCandidateId") REFERENCES "CandidateProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeImportItem" ADD CONSTRAINT "ResumeImportItem_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeImportItem" ADD CONSTRAINT "ResumeImportItem_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
