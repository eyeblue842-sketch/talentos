-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('RECRUITER', 'CANDIDATE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN');

-- CreateEnum
CREATE TYPE "CandidateTag" AS ENUM ('SHORTLISTED', 'REJECTED', 'HOLD');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('APPLIED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('IMMEDIATE', 'TWO_WEEKS', 'ONE_MONTH', 'NOT_LOOKING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruiterProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyEmailDomain" TEXT NOT NULL,
    "companyName" TEXT,
    "aboutCompany" TEXT,
    "industryDomain" TEXT,
    "companyType" TEXT,
    "headquartersLocation" TEXT,
    "startedYear" INTEGER,
    "employeeCount" INTEGER,
    "branchCount" INTEGER,
    "officeLocations" TEXT[],
    "annualTurnover" TEXT,
    "designation" TEXT,
    "workingSince" INTEGER,
    "companySize" TEXT,
    "website" TEXT,
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RecruiterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "headline" TEXT,
    "location" TEXT,
    "preferredLocations" TEXT[],
    "totalExperience" INTEGER NOT NULL DEFAULT 0,
    "currentCtcLpa" INTEGER,
    "expectedCtcLpa" INTEGER,
    "availability" "AvailabilityStatus" NOT NULL DEFAULT 'IMMEDIATE',
    "skills" TEXT[],
    "summary" TEXT,
    "resumeUrl" TEXT,
    "sharedResumeSlug" TEXT,
    "profileViews" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "recruiterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "skillsRequired" TEXT[],
    "experienceMin" INTEGER NOT NULL,
    "experienceMax" INTEGER NOT NULL,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "location" TEXT NOT NULL,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "currentStage" "PipelineStage" NOT NULL DEFAULT 'APPLIED',
    "statusLabel" TEXT NOT NULL DEFAULT 'Applied',
    "coverLetter" TEXT,
    "recruiterTag" "CandidateTag",
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "interviewScheduledAt" TIMESTAMP(3),
    "interviewerName" TEXT,
    "recruiterNotes" TEXT,
    "matchScore" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtsNote" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtsNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationActivity" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeBuilder" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'classic',
    "personal" JSONB NOT NULL,
    "education" JSONB NOT NULL,
    "experience" JSONB NOT NULL,
    "skills" JSONB NOT NULL,
    "projects" JSONB NOT NULL,
    "completedScore" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeBuilder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedCandidate" (
    "id" TEXT NOT NULL,
    "recruiterId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "tag" "CandidateTag",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RecruiterProfile_userId_key" ON "RecruiterProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProfile_userId_key" ON "CandidateProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProfile_sharedResumeSlug_key" ON "CandidateProfile"("sharedResumeSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Job_slug_key" ON "Job"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobId_candidateId_key" ON "Application"("jobId", "candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "ResumeBuilder_candidateId_key" ON "ResumeBuilder"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedCandidate_recruiterId_candidateId_key" ON "SavedCandidate"("recruiterId", "candidateId");

-- AddForeignKey
ALTER TABLE "RecruiterProfile" ADD CONSTRAINT "RecruiterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtsNote" ADD CONSTRAINT "AtsNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtsNote" ADD CONSTRAINT "AtsNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationActivity" ADD CONSTRAINT "ApplicationActivity_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeBuilder" ADD CONSTRAINT "ResumeBuilder_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCandidate" ADD CONSTRAINT "SavedCandidate_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "RecruiterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCandidate" ADD CONSTRAINT "SavedCandidate_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

