-- CreateEnum
CREATE TYPE "JobVisibility" AS ENUM ('EXTERNAL', 'INTERNAL', 'BOTH');

-- CreateEnum
CREATE TYPE "ScreeningQuestionType" AS ENUM ('YES_NO', 'SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'CURRENCY', 'DATE', 'EMAIL', 'PHONE', 'URL', 'SINGLE_SELECT', 'MULTI_SELECT', 'FILE_UPLOAD');

-- CreateEnum
CREATE TYPE "ScreeningRuleOperator" AS ENUM ('EQUALS', 'NOT_EQUALS', 'LESS_THAN', 'LESS_THAN_OR_EQUAL', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'CONTAINS', 'DOES_NOT_CONTAIN', 'IN', 'NOT_IN');

-- CreateEnum
CREATE TYPE "ScreeningOutcome" AS ENUM ('MEETS_CRITERIA', 'REVIEW_REQUIRED', 'DOES_NOT_MEET_CRITERIA');

-- CreateEnum
CREATE TYPE "ApplicationSourceType" AS ENUM ('CAREER_PAGE', 'JOB_BOARD', 'REFERRAL', 'DIRECT_LINK', 'INTERNAL_PORTAL', 'API', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ResumeAssetKind" AS ENUM ('RESUME', 'SCREENING_FILE');

-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN     "latestResumeAssetId" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "applicationClosesAt" TIMESTAMP(3),
ADD COLUMN     "applicationOpensAt" TIMESTAMP(3),
ADD COLUMN     "autoCloseOnTargetHire" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxApplications" INTEGER,
ADD COLUMN     "targetHires" INTEGER,
ADD COLUMN     "visibility" "JobVisibility" NOT NULL DEFAULT 'EXTERNAL';

-- CreateTable
CREATE TABLE "ScreeningQuestionTemplate" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "internalLabel" TEXT,
    "helpText" TEXT,
    "placeholder" TEXT,
    "questionType" "ScreeningQuestionType" NOT NULL,
    "isRequiredByDefault" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "validationConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreeningQuestionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobScreeningQuestion" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "templateId" TEXT,
    "createdById" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "internalLabel" TEXT,
    "helpText" TEXT,
    "placeholder" TEXT,
    "questionType" "ScreeningQuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "validationConfig" JSONB,
    "rules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobScreeningQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeAsset" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "kind" "ResumeAssetKind" NOT NULL DEFAULT 'RESUME',
    "storageKey" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "applicationId" TEXT,
    "resumeSnapshotId" TEXT,
    "sourceType" "ApplicationSourceType" NOT NULL DEFAULT 'UNKNOWN',
    "sourceName" TEXT,
    "sourceCampaign" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "referrer" TEXT,
    "directLinkIdentifier" TEXT,
    "screeningSummary" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationResumeSnapshot" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "resumeAssetId" TEXT,
    "storageKey" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationResumeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationScreeningAnswer" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "originalQuestionId" TEXT,
    "fileAssetId" TEXT,
    "questionTextSnapshot" TEXT NOT NULL,
    "internalLabelSnapshot" TEXT,
    "helpTextSnapshot" TEXT,
    "placeholderSnapshot" TEXT,
    "questionTypeSnapshot" "ScreeningQuestionType" NOT NULL,
    "optionsSnapshot" JSONB,
    "validationSnapshot" JSONB,
    "requiredSnapshot" BOOLEAN NOT NULL,
    "answerValue" JSONB,
    "screeningOutcome" "ScreeningOutcome",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationScreeningAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationFlag" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "questionId" TEXT,
    "outcome" "ScreeningOutcome" NOT NULL,
    "operator" "ScreeningRuleOperator",
    "internalReason" TEXT NOT NULL,
    "metadata" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationTimeline" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "eventType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "isCandidateVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScreeningQuestionTemplate_organisationId_isActive_updatedAt_idx" ON "ScreeningQuestionTemplate"("organisationId", "isActive", "updatedAt");

-- CreateIndex
CREATE INDEX "ScreeningQuestionTemplate_organisationId_questionType_isAct_idx" ON "ScreeningQuestionTemplate"("organisationId", "questionType", "isActive");

-- CreateIndex
CREATE INDEX "JobScreeningQuestion_organisationId_jobId_displayOrder_idx" ON "JobScreeningQuestion"("organisationId", "jobId", "displayOrder");

-- CreateIndex
CREATE INDEX "JobScreeningQuestion_jobId_isActive_displayOrder_idx" ON "JobScreeningQuestion"("jobId", "isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "JobScreeningQuestion_templateId_idx" ON "JobScreeningQuestion"("templateId");

-- CreateIndex
CREATE INDEX "ResumeAsset_candidateId_kind_createdAt_idx" ON "ResumeAsset"("candidateId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "ResumeAsset_ownerUserId_createdAt_idx" ON "ResumeAsset"("ownerUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_publicReference_key" ON "JobApplication"("publicReference");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_applicationId_key" ON "JobApplication"("applicationId");

-- CreateIndex
CREATE INDEX "JobApplication_organisationId_submittedAt_idx" ON "JobApplication"("organisationId", "submittedAt");

-- CreateIndex
CREATE INDEX "JobApplication_organisationId_jobId_submittedAt_idx" ON "JobApplication"("organisationId", "jobId", "submittedAt");

-- CreateIndex
CREATE INDEX "JobApplication_candidateId_submittedAt_idx" ON "JobApplication"("candidateId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_jobId_candidateId_key" ON "JobApplication"("jobId", "candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationResumeSnapshot_applicationId_key" ON "ApplicationResumeSnapshot"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationResumeSnapshot_organisationId_createdAt_idx" ON "ApplicationResumeSnapshot"("organisationId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationScreeningAnswer_organisationId_applicationId_idx" ON "ApplicationScreeningAnswer"("organisationId", "applicationId");

-- CreateIndex
CREATE INDEX "ApplicationScreeningAnswer_applicationId_originalQuestionId_idx" ON "ApplicationScreeningAnswer"("applicationId", "originalQuestionId");

-- CreateIndex
CREATE INDEX "ApplicationFlag_organisationId_createdAt_idx" ON "ApplicationFlag"("organisationId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationFlag_applicationId_createdAt_idx" ON "ApplicationFlag"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationFlag_outcome_createdAt_idx" ON "ApplicationFlag"("outcome", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationTimeline_organisationId_applicationId_createdAt_idx" ON "ApplicationTimeline"("organisationId", "applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "Job_applicationDeadline_idx" ON "Job"("applicationDeadline");

-- CreateIndex
CREATE INDEX "Job_status_visibility_applicationOpensAt_applicationClosesA_idx" ON "Job"("status", "visibility", "applicationOpensAt", "applicationClosesAt");

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_latestResumeAssetId_fkey" FOREIGN KEY ("latestResumeAssetId") REFERENCES "ResumeAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningQuestionTemplate" ADD CONSTRAINT "ScreeningQuestionTemplate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningQuestionTemplate" ADD CONSTRAINT "ScreeningQuestionTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobScreeningQuestion" ADD CONSTRAINT "JobScreeningQuestion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobScreeningQuestion" ADD CONSTRAINT "JobScreeningQuestion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobScreeningQuestion" ADD CONSTRAINT "JobScreeningQuestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ScreeningQuestionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobScreeningQuestion" ADD CONSTRAINT "JobScreeningQuestion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeAsset" ADD CONSTRAINT "ResumeAsset_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeAsset" ADD CONSTRAINT "ResumeAsset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationResumeSnapshot" ADD CONSTRAINT "ApplicationResumeSnapshot_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationResumeSnapshot" ADD CONSTRAINT "ApplicationResumeSnapshot_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationResumeSnapshot" ADD CONSTRAINT "ApplicationResumeSnapshot_resumeAssetId_fkey" FOREIGN KEY ("resumeAssetId") REFERENCES "ResumeAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationScreeningAnswer" ADD CONSTRAINT "ApplicationScreeningAnswer_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationScreeningAnswer" ADD CONSTRAINT "ApplicationScreeningAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationScreeningAnswer" ADD CONSTRAINT "ApplicationScreeningAnswer_originalQuestionId_fkey" FOREIGN KEY ("originalQuestionId") REFERENCES "JobScreeningQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationScreeningAnswer" ADD CONSTRAINT "ApplicationScreeningAnswer_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "ResumeAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationFlag" ADD CONSTRAINT "ApplicationFlag_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationFlag" ADD CONSTRAINT "ApplicationFlag_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationFlag" ADD CONSTRAINT "ApplicationFlag_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "JobScreeningQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationTimeline" ADD CONSTRAINT "ApplicationTimeline_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationTimeline" ADD CONSTRAINT "ApplicationTimeline_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
