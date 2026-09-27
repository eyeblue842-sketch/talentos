-- Uploaded company-logo storage references (additive, nullable).
ALTER TABLE "Organisation" ADD COLUMN IF NOT EXISTS "logoStorageProvider" TEXT;
ALTER TABLE "Organisation" ADD COLUMN IF NOT EXISTS "logoStorageKey" TEXT;
ALTER TABLE "Organisation" ADD COLUMN IF NOT EXISTS "logoMimeType" TEXT;
