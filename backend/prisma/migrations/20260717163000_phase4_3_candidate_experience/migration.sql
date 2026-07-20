-- AlterEnum
ALTER TYPE "PipelineStage" ADD VALUE IF NOT EXISTS 'WITHDRAWN';

-- CreateEnum
CREATE TYPE "JobAlertFrequency" AS ENUM ('IMMEDIATE', 'DAILY', 'WEEKLY', 'DISABLED');

-- CreateEnum
CREATE TYPE "CandidateActivityType" AS ENUM (
  'PROFILE_UPDATED',
  'RESUME_UPLOADED',
  'JOB_VIEWED',
  'JOB_SAVED',
  'JOB_UNSAVED',
  'APPLICATION_SUBMITTED',
  'APPLICATION_WITHDRAWN',
  'NOTIFICATION_OPENED',
  'RECENT_HISTORY_CLEARED',
  'PREFERENCES_UPDATED'
);

-- AlterTable
ALTER TABLE "CandidateProfile"
ADD COLUMN "notifyForApplicationUpdates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notifyForOffers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notifyForProfileReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notifyForMarketing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "willingToRelocate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "minExpectedSalary" INTEGER,
ADD COLUMN "preferredCurrency" TEXT,
ADD COLUMN "workAuthorization" TEXT,
ADD COLUMN "requiresVisaSponsorship" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "preferredIndustries" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "preferredCompanySizes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "travelWillingness" TEXT,
ADD COLUMN "jobAlertEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "jobAlertFrequency" "JobAlertFrequency" NOT NULL DEFAULT 'WEEKLY';

-- AlterTable
ALTER TABLE "JobApplication"
ADD COLUMN "candidateStatusUpdatedAt" TIMESTAMP(3),
ADD COLUMN "withdrawnAt" TIMESTAMP(3),
ADD COLUMN "withdrawalReason" TEXT,
ADD COLUMN "withdrawalNote" TEXT,
ADD COLUMN "withdrawnByUserId" TEXT;

-- AlterTable
ALTER TABLE "Notification"
ADD COLUMN "metadata" JSONB;

-- CreateTable
CREATE TABLE "CandidateJobView" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "source" TEXT,
  "referrerClassification" TEXT,
  "firstViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "viewCount" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "CandidateJobView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateActivity" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "userId" TEXT,
  "applicationId" TEXT,
  "jobId" TEXT,
  "type" "CandidateActivityType" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CandidateActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CandidateJobView_candidateId_jobId_key" ON "CandidateJobView"("candidateId", "jobId");
CREATE INDEX "CandidateJobView_candidateId_lastViewedAt_idx" ON "CandidateJobView"("candidateId", "lastViewedAt");
CREATE INDEX "CandidateJobView_jobId_idx" ON "CandidateJobView"("jobId");

-- CreateIndex
CREATE INDEX "CandidateActivity_candidateId_createdAt_idx" ON "CandidateActivity"("candidateId", "createdAt");
CREATE INDEX "CandidateActivity_type_createdAt_idx" ON "CandidateActivity"("type", "createdAt");

-- CreateIndex
CREATE INDEX "JobApplication_candidateId_updatedAt_idx" ON "JobApplication"("candidateId", "updatedAt");
CREATE INDEX "JobApplication_candidateId_withdrawnAt_idx" ON "JobApplication"("candidateId", "withdrawnAt");
CREATE INDEX "ApplicationTimeline_applicationId_isCandidateVisible_createdAt_idx" ON "ApplicationTimeline"("applicationId", "isCandidateVisible", "createdAt");

-- AddForeignKey
ALTER TABLE "CandidateJobView"
ADD CONSTRAINT "CandidateJobView_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidateJobView"
ADD CONSTRAINT "CandidateJobView_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidateActivity"
ADD CONSTRAINT "CandidateActivity_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
