-- Uploadable .docx offer letter template file for merge.
ALTER TABLE "OfferTemplate" ADD COLUMN "documentStorageKey" TEXT;
ALTER TABLE "OfferTemplate" ADD COLUMN "documentStorageProvider" TEXT;
ALTER TABLE "OfferTemplate" ADD COLUMN "documentFilename" TEXT;
