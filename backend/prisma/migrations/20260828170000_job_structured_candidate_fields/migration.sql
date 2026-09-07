-- Adds structured, backward-compatible fields for the Naukri-style job-post
-- redesign. All three columns are nullable JSON with no default, so every
-- existing Job row is valid without a backfill, and every existing reader
-- of Job.location/Job.requirements/Job.responsibilities/Job.department/
-- Job.experienceMin/Job.experienceMax is unaffected.
ALTER TABLE "Job" ADD COLUMN "locations" JSONB;
ALTER TABLE "Job" ADD COLUMN "candidateQualifications" JSONB;
ALTER TABLE "Job" ADD COLUMN "preferredCandidateProfile" JSONB;
