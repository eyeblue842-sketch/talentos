-- Extra Zoho-style offer fields (designation, joining location, working days, etc.).
ALTER TABLE "Offer" ADD COLUMN "customFields" JSONB;
