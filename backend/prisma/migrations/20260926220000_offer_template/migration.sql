-- Reusable, editable offer templates + offer letter merge body.
CREATE TABLE "OfferTemplate" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "defaults" JSONB,
    "letterBody" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OfferTemplate_organisationId_idx" ON "OfferTemplate"("organisationId");

ALTER TABLE "OfferTemplate" ADD CONSTRAINT "OfferTemplate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Offer" ADD COLUMN "offerTemplateId" TEXT;
