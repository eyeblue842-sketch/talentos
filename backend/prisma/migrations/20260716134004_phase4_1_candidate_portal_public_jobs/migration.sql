-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PRIVATE', 'RECRUITERS_ONLY', 'PUBLIC');

-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN     "currentTitle" TEXT,
ADD COLUMN     "employmentPreferences" "EmploymentType"[] DEFAULT ARRAY[]::"EmploymentType"[],
ADD COLUMN     "githubUrl" TEXT,
ADD COLUMN     "linkedInUrl" TEXT,
ADD COLUMN     "noticePeriodDays" INTEGER,
ADD COLUMN     "notifyForInterviews" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyForRecommendations" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyForSavedJobUpdates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "portfolioUrl" TEXT,
ADD COLUMN     "preferredRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "profileImageUrl" TEXT,
ADD COLUMN     "profileVisibility" "ProfileVisibility" NOT NULL DEFAULT 'PRIVATE',
ADD COLUMN     "recommendationEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "workplacePreferences" "WorkplaceType"[] DEFAULT ARRAY[]::"WorkplaceType"[];

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "featuredInPortal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicSalaryEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "responsibilities" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "benefitsSummary" TEXT,
ADD COLUMN     "careersEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cultureSummary" TEXT,
ADD COLUMN     "headquarters" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "organisationSize" TEXT,
ADD COLUMN     "publicDescription" TEXT,
ADD COLUMN     "publicLocations" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "SavedJob" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobId" TEXT,
    "organisationId" TEXT,
    "jobSlugSnapshot" TEXT NOT NULL,
    "jobTitleSnapshot" TEXT NOT NULL,
    "organisationNameSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedJob_candidateId_createdAt_idx" ON "SavedJob"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "SavedJob_jobId_idx" ON "SavedJob"("jobId");

-- CreateIndex
CREATE INDEX "SavedJob_organisationId_createdAt_idx" ON "SavedJob"("organisationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedJob_candidateId_jobId_key" ON "SavedJob"("candidateId", "jobId");

-- CreateIndex
CREATE INDEX "CandidateProfile_recommendationEnabled_updatedAt_idx" ON "CandidateProfile"("recommendationEnabled", "updatedAt");

-- CreateIndex
CREATE INDEX "Job_isPublic_status_createdAt_idx" ON "Job"("isPublic", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "SavedJob" ADD CONSTRAINT "SavedJob_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedJob" ADD CONSTRAINT "SavedJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
