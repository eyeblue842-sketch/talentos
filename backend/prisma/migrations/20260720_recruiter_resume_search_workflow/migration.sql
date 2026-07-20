CREATE TYPE "RecruiterSavedSearchType" AS ENUM ('SAVED', 'RECENT');

CREATE TABLE "RecruiterSavedSearch" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "recruiterId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "type" "RecruiterSavedSearchType" NOT NULL DEFAULT 'SAVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruiterSavedSearch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TalentPool" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "createdByRecruiterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalentPool_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TalentPoolCandidate" (
    "id" TEXT NOT NULL,
    "talentPoolId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TalentPoolCandidate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecruiterSavedSearch_organisationId_type_updatedAt_idx" ON "RecruiterSavedSearch"("organisationId", "type", "updatedAt");
CREATE INDEX "RecruiterSavedSearch_recruiterId_type_updatedAt_idx" ON "RecruiterSavedSearch"("recruiterId", "type", "updatedAt");
CREATE INDEX "TalentPool_organisationId_updatedAt_idx" ON "TalentPool"("organisationId", "updatedAt");
CREATE INDEX "TalentPoolCandidate_candidateId_createdAt_idx" ON "TalentPoolCandidate"("candidateId", "createdAt");

CREATE UNIQUE INDEX "TalentPool_organisationId_name_key" ON "TalentPool"("organisationId", "name");
CREATE UNIQUE INDEX "TalentPoolCandidate_talentPoolId_candidateId_key" ON "TalentPoolCandidate"("talentPoolId", "candidateId");

ALTER TABLE "RecruiterSavedSearch" ADD CONSTRAINT "RecruiterSavedSearch_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruiterSavedSearch" ADD CONSTRAINT "RecruiterSavedSearch_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "RecruiterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TalentPool" ADD CONSTRAINT "TalentPool_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TalentPool" ADD CONSTRAINT "TalentPool_createdByRecruiterId_fkey" FOREIGN KEY ("createdByRecruiterId") REFERENCES "RecruiterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TalentPoolCandidate" ADD CONSTRAINT "TalentPoolCandidate_talentPoolId_fkey" FOREIGN KEY ("talentPoolId") REFERENCES "TalentPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TalentPoolCandidate" ADD CONSTRAINT "TalentPoolCandidate_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
