-- Adds the additional-recipients array for new-application notifications.
-- Additive and backward-compatible: the column is NOT NULL with an empty-array
-- default, so every existing Job row is valid without a backfill and its
-- primary applicationNotificationEmail is preserved unchanged. These emails are
-- internal notification recipients only and are never exposed publicly.
ALTER TABLE "Job" ADD COLUMN "applicationNotificationEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
