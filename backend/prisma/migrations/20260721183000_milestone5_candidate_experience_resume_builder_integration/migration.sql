-- CreateEnum
CREATE TYPE "CandidateEmploymentStatus" AS ENUM ('EMPLOYED', 'OPEN_TO_WORK', 'UNEMPLOYED', 'STUDENT', 'FREELANCER', 'CAREER_BREAK');

-- CreateEnum
CREATE TYPE "ResumeAssetStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "ResumeAssetSource" AS ENUM ('UPLOAD', 'EXTERNAL_BUILDER');

-- CreateEnum
CREATE TYPE "ResumeParseStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "AccountLifecycleStatus" AS ENUM ('ACTIVE', 'DEACTIVATION_REQUESTED', 'DEACTIVATED');

-- AlterTable
ALTER TABLE "CandidateProfile"
ADD COLUMN "phoneNumber" TEXT,
ADD COLUMN "currentEmployer" TEXT,
ADD COLUMN "currentDesignation" TEXT,
ADD COLUMN "employmentStatus" "CandidateEmploymentStatus",
ADD COLUMN "lastWorkingDate" TIMESTAMP(3),
ADD COLUMN "skillEntries" JSONB,
ADD COLUMN "experienceEntries" JSONB,
ADD COLUMN "educationEntries" JSONB,
ADD COLUMN "certificationEntries" JSONB,
ADD COLUMN "languageEntries" JSONB,
ADD COLUMN "projectEntries" JSONB,
ADD COLUMN "portfolioLinks" JSONB,
ADD COLUMN "searchableProfile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "phoneVisibleToRecruiters" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "salaryVisibleToRecruiters" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "resumeVisibleToRecruiters" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "onboardingStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "onboardingLastSavedAt" TIMESTAMP(3),
ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN "onboardingSkippedResume" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "notificationPreferences" JSONB,
ADD COLUMN "accountLifecycleStatus" "AccountLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "accountDeactivationRequestedAt" TIMESTAMP(3),
ADD COLUMN "accountDeactivatedAt" TIMESTAMP(3),
ADD COLUMN "accountDeactivationReason" TEXT,
ADD COLUMN "dataExportRequestedAt" TIMESTAMP(3),
ADD COLUMN "dataExportCompletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ResumeAsset"
ADD COLUMN "status" "ResumeAssetStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "source" "ResumeAssetSource" NOT NULL DEFAULT 'UPLOAD',
ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "externalResumeId" TEXT,
ADD COLUMN "externalResumeUrl" TEXT,
ADD COLUMN "externalResumeVersion" TEXT,
ADD COLUMN "lastSynchronizedAt" TIMESTAMP(3),
ADD COLUMN "parsingStatus" "ResumeParseStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "parsedText" TEXT,
ADD COLUMN "parsedData" JSONB,
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill
UPDATE "ResumeAsset"
SET "isPrimary" = true
WHERE "id" IN (
  SELECT "latestResumeAssetId"
  FROM "CandidateProfile"
  WHERE "latestResumeAssetId" IS NOT NULL
);

-- CreateIndex
CREATE INDEX "ResumeAsset_candidateId_kind_status_createdAt_idx" ON "ResumeAsset"("candidateId", "kind", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ResumeAsset_candidateId_isPrimary_kind_idx" ON "ResumeAsset"("candidateId", "isPrimary", "kind");

-- CreateIndex
CREATE INDEX "ResumeAsset_source_parsingStatus_createdAt_idx" ON "ResumeAsset"("source", "parsingStatus", "createdAt");
