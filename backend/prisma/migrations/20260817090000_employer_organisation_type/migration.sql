-- CreateEnum
CREATE TYPE "OrganisationType" AS ENUM ('CONSULTANCY', 'COMPANY');

-- CreateEnum
CREATE TYPE "DomainVerificationStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'VERIFIED');

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "domainVerificationStatus" "DomainVerificationStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
ADD COLUMN     "type" "OrganisationType",
ADD COLUMN     "verifiedDomain" TEXT;

-- CreateIndex
CREATE INDEX "Organisation_type_verifiedDomain_idx" ON "Organisation"("type", "verifiedDomain");
