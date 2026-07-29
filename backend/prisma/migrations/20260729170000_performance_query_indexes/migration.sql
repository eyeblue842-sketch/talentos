CREATE INDEX "Application_organisationId_jobId_updatedAt_idx"
  ON "Application"("organisationId", "jobId", "updatedAt");

CREATE INDEX "Application_organisationId_candidateId_updatedAt_idx"
  ON "Application"("organisationId", "candidateId", "updatedAt");

CREATE INDEX "CandidateRankingSnapshot_organisationId_jobId_createdAt_idx"
  ON "CandidateRankingSnapshot"("organisationId", "jobId", "createdAt");

CREATE INDEX "RecruiterSavedSearch_organisationId_recruiterId_type_updatedAt_idx"
  ON "RecruiterSavedSearch"("organisationId", "recruiterId", "type", "updatedAt");

CREATE INDEX "RecruiterSavedSearch_organisationId_recruiterId_type_createdAt_idx"
  ON "RecruiterSavedSearch"("organisationId", "recruiterId", "type", "createdAt");

CREATE INDEX "SemanticSearchQuery_organisationId_createdByUserId_createdAt_idx"
  ON "SemanticSearchQuery"("organisationId", "createdByUserId", "createdAt");
