-- Candidates can mark themselves as open to freelance work; recruiters can search on it.
ALTER TYPE "EmploymentType" ADD VALUE IF NOT EXISTS 'FREELANCE';

-- Whether the candidate's expected CTC is negotiable (NULL = not answered).
ALTER TABLE "CandidateProfile" ADD COLUMN IF NOT EXISTS "salaryNegotiable" BOOLEAN;
