ALTER TYPE "IntelligenceFeature" ADD VALUE 'CANDIDATE_RANKING';
ALTER TYPE "BackgroundTaskType" ADD VALUE 'CANDIDATE_MATCH_BULK_GENERATION';
ALTER TYPE "BackgroundTaskType" ADD VALUE 'JOB_CANDIDATE_RANKING_GENERATION';

CREATE TYPE "MatchScoringProfileVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "RecruiterMatchOverrideType" AS ENUM ('SCORE_ADJUSTMENT', 'RECOMMENDATION_OVERRIDE', 'KNOCKOUT_OVERRIDE', 'NOTES_ONLY');
CREATE TYPE "CandidateRankingStatus" AS ENUM ('PENDING', 'READY', 'STALE', 'FAILED', 'DISABLED', 'PARTIAL');

CREATE TABLE "MatchScoringProfile" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activeVersionId" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "activatedByUserId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchScoringProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatchScoringProfileVersion" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "MatchScoringProfileVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "weightsJson" JSONB NOT NULL,
    "knockoutRulesJson" JSONB NOT NULL,
    "thresholdsJson" JSONB NOT NULL,
    "confidenceRulesJson" JSONB NOT NULL,
    "normalizationVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "promptKey" TEXT,
    "promptVersion" TEXT,
    "resultVersion" TEXT NOT NULL,
    "metadata" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchScoringProfileVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateRankingSnapshot" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "CandidateRankingStatus" NOT NULL DEFAULT 'PENDING',
    "candidatePoolFingerprint" TEXT NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "scoringProfileVersionId" TEXT,
    "latestExecutionId" TEXT,
    "triggeredByUserId" TEXT,
    "generatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "staleReason" TEXT,
    "totalCandidates" INTEGER NOT NULL DEFAULT 0,
    "processedCandidates" INTEGER NOT NULL DEFAULT 0,
    "failedCandidates" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateRankingSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecruiterMatchOverride" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "matchStateId" TEXT NOT NULL,
    "matchResultId" TEXT,
    "rankingSnapshotId" TEXT,
    "type" "RecruiterMatchOverrideType" NOT NULL,
    "scoreDelta" INTEGER,
    "recommendationOverride" TEXT,
    "knockoutOverride" BOOLEAN,
    "reason" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruiterMatchOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateRankingEntry" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "matchStateId" TEXT NOT NULL,
    "matchResultId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "generatedOverallScore" INTEGER NOT NULL,
    "effectiveOverallScore" INTEGER NOT NULL,
    "confidenceScore" DECIMAL(5,2),
    "generatedRecommendation" TEXT NOT NULL,
    "effectiveRecommendation" TEXT NOT NULL,
    "fitBand" TEXT NOT NULL,
    "strengthSummary" TEXT,
    "gapSummary" TEXT,
    "isKnockedOut" BOOLEAN NOT NULL DEFAULT false,
    "hasOverride" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateRankingEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatchScoringProfile_organisationId_key_key" ON "MatchScoringProfile"("organisationId", "key");
CREATE INDEX "MatchScoringProfile_organisationId_isActive_archivedAt_idx" ON "MatchScoringProfile"("organisationId", "isActive", "archivedAt");

CREATE UNIQUE INDEX "MatchScoringProfileVersion_profileId_version_key" ON "MatchScoringProfileVersion"("profileId", "version");
CREATE INDEX "MatchScoringProfileVersion_organisationId_status_createdAt_idx" ON "MatchScoringProfileVersion"("organisationId", "status", "createdAt");

CREATE INDEX "CandidateRankingSnapshot_organisationId_jobId_status_createdAt_idx" ON "CandidateRankingSnapshot"("organisationId", "jobId", "status", "createdAt");
CREATE INDEX "CandidateRankingSnapshot_jobId_createdAt_idx" ON "CandidateRankingSnapshot"("jobId", "createdAt");

CREATE INDEX "RecruiterMatchOverride_organisationId_jobId_candidateId_createdAt_idx" ON "RecruiterMatchOverride"("organisationId", "jobId", "candidateId", "createdAt");
CREATE INDEX "RecruiterMatchOverride_matchStateId_createdAt_idx" ON "RecruiterMatchOverride"("matchStateId", "createdAt");
CREATE INDEX "RecruiterMatchOverride_rankingSnapshotId_createdAt_idx" ON "RecruiterMatchOverride"("rankingSnapshotId", "createdAt");

CREATE UNIQUE INDEX "CandidateRankingEntry_snapshotId_candidateId_key" ON "CandidateRankingEntry"("snapshotId", "candidateId");
CREATE UNIQUE INDEX "CandidateRankingEntry_snapshotId_rank_key" ON "CandidateRankingEntry"("snapshotId", "rank");
CREATE INDEX "CandidateRankingEntry_organisationId_jobId_rank_idx" ON "CandidateRankingEntry"("organisationId", "jobId", "rank");
CREATE INDEX "CandidateRankingEntry_candidateId_createdAt_idx" ON "CandidateRankingEntry"("candidateId", "createdAt");
CREATE INDEX "CandidateRankingEntry_jobId_effectiveOverallScore_rank_idx" ON "CandidateRankingEntry"("jobId", "effectiveOverallScore", "rank");

ALTER TABLE "MatchScoringProfileVersion"
    ADD CONSTRAINT "MatchScoringProfileVersion_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchScoringProfileVersion"
    ADD CONSTRAINT "MatchScoringProfileVersion_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "MatchScoringProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchScoringProfileVersion"
    ADD CONSTRAINT "MatchScoringProfileVersion_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MatchScoringProfile"
    ADD CONSTRAINT "MatchScoringProfile_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchScoringProfile"
    ADD CONSTRAINT "MatchScoringProfile_activeVersionId_fkey"
    FOREIGN KEY ("activeVersionId") REFERENCES "MatchScoringProfileVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MatchScoringProfile"
    ADD CONSTRAINT "MatchScoringProfile_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MatchScoringProfile"
    ADD CONSTRAINT "MatchScoringProfile_updatedByUserId_fkey"
    FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MatchScoringProfile"
    ADD CONSTRAINT "MatchScoringProfile_activatedByUserId_fkey"
    FOREIGN KEY ("activatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CandidateRankingSnapshot"
    ADD CONSTRAINT "CandidateRankingSnapshot_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidateRankingSnapshot"
    ADD CONSTRAINT "CandidateRankingSnapshot_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidateRankingSnapshot"
    ADD CONSTRAINT "CandidateRankingSnapshot_scoringProfileVersionId_fkey"
    FOREIGN KEY ("scoringProfileVersionId") REFERENCES "MatchScoringProfileVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CandidateRankingSnapshot"
    ADD CONSTRAINT "CandidateRankingSnapshot_latestExecutionId_fkey"
    FOREIGN KEY ("latestExecutionId") REFERENCES "IntelligenceExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CandidateRankingSnapshot"
    ADD CONSTRAINT "CandidateRankingSnapshot_triggeredByUserId_fkey"
    FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecruiterMatchOverride"
    ADD CONSTRAINT "RecruiterMatchOverride_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecruiterMatchOverride"
    ADD CONSTRAINT "RecruiterMatchOverride_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecruiterMatchOverride"
    ADD CONSTRAINT "RecruiterMatchOverride_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecruiterMatchOverride"
    ADD CONSTRAINT "RecruiterMatchOverride_matchStateId_fkey"
    FOREIGN KEY ("matchStateId") REFERENCES "CandidateJobMatchState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecruiterMatchOverride"
    ADD CONSTRAINT "RecruiterMatchOverride_matchResultId_fkey"
    FOREIGN KEY ("matchResultId") REFERENCES "IntelligenceResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecruiterMatchOverride"
    ADD CONSTRAINT "RecruiterMatchOverride_rankingSnapshotId_fkey"
    FOREIGN KEY ("rankingSnapshotId") REFERENCES "CandidateRankingSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecruiterMatchOverride"
    ADD CONSTRAINT "RecruiterMatchOverride_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CandidateRankingEntry"
    ADD CONSTRAINT "CandidateRankingEntry_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "CandidateRankingSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidateRankingEntry"
    ADD CONSTRAINT "CandidateRankingEntry_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidateRankingEntry"
    ADD CONSTRAINT "CandidateRankingEntry_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidateRankingEntry"
    ADD CONSTRAINT "CandidateRankingEntry_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidateRankingEntry"
    ADD CONSTRAINT "CandidateRankingEntry_matchStateId_fkey"
    FOREIGN KEY ("matchStateId") REFERENCES "CandidateJobMatchState"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CandidateRankingEntry"
    ADD CONSTRAINT "CandidateRankingEntry_matchResultId_fkey"
    FOREIGN KEY ("matchResultId") REFERENCES "IntelligenceResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
