-- Add free-text hiring manager contact fields to Job for ATS openings.
ALTER TABLE "Job" ADD COLUMN "hiringManagerName" TEXT;
ALTER TABLE "Job" ADD COLUMN "hiringManagerEmail" TEXT;
