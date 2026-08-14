-- CreateEnum
CREATE TYPE "BillingProductCode" AS ENUM ('JOB_POST_45D', 'ATS_DB_1M', 'ATS_DB_6M', 'ATS_DB_12M');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'CANCELLED', 'PAYMENT_FAILED', 'REFUNDED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "JobCreditSource" AS ENUM ('SUBSCRIPTION_GRANT', 'PURCHASED_CREDIT', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "JobCreditLedgerEntryType" AS ENUM ('GRANT', 'CONSUME', 'REVERSAL', 'EXPIRY', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PaymentWebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "GstSupplyType" AS ENUM ('INTRA_STATE', 'INTER_STATE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('FINAL', 'REVIEW_REQUIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BackgroundTaskType" ADD VALUE 'SUBSCRIPTION_RENEWAL_REMINDER';
ALTER TYPE "BackgroundTaskType" ADD VALUE 'JOB_AUTO_CLOSE';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'BILLING';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "activeUntil" TIMESTAMP(3),
ADD COLUMN     "autoCloseOverrideAt" TIMESTAMP(3),
ADD COLUMN     "autoCloseOverrideByUserId" TEXT,
ADD COLUMN     "autoCloseOverrideReason" TEXT,
ADD COLUMN     "autoClosedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProductPlan" (
    "id" TEXT NOT NULL,
    "code" "BillingProductCode" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "baseAmountPaise" INTEGER NOT NULL,
    "gstRatePercent" INTEGER NOT NULL DEFAULT 18,
    "gstAmountPaise" INTEGER NOT NULL,
    "totalAmountPaise" INTEGER NOT NULL,
    "durationMonths" INTEGER,
    "includedJobCredits" INTEGER NOT NULL DEFAULT 0,
    "jobActiveDays" INTEGER NOT NULL DEFAULT 45,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "razorpayButtonId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "purchaserUserId" TEXT NOT NULL,
    "productPlanId" TEXT NOT NULL,
    "productCode" "BillingProductCode" NOT NULL,
    "productVersion" INTEGER NOT NULL,
    "productSnapshot" JSONB NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "amountPaise" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "notesSnapshot" JSONB,
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "disputeStatus" TEXT,
    "requiresManualReview" BOOLEAN NOT NULL DEFAULT false,
    "manualReviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySubscription" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "productCode" "BillingProductCode" NOT NULL,
    "productVersion" INTEGER NOT NULL,
    "planSnapshot" JSONB NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "atsAccess" BOOLEAN NOT NULL DEFAULT false,
    "resumeDatabaseAccess" BOOLEAN NOT NULL DEFAULT false,
    "includedJobCredits" INTEGER NOT NULL DEFAULT 0,
    "renewalReminderSentAt" TIMESTAMP(3),
    "renewalReminderFailedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspensionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPostingCreditLedger" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "entryType" "JobCreditLedgerEntryType" NOT NULL,
    "source" "JobCreditSource",
    "amount" INTEGER NOT NULL,
    "purchaseId" TEXT,
    "subscriptionId" TEXT,
    "jobId" TEXT,
    "validFrom" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "reason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPostingCreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "eventType" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" "PaymentWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "relatedPurchaseId" TEXT,
    "summary" JSONB,
    "processingError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyBillingProfile" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "legalCompanyName" TEXT NOT NULL,
    "billingEmail" TEXT NOT NULL,
    "billingPhone" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "gstin" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyBillingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billingProfileSnapshot" JSONB,
    "productSnapshot" JSONB NOT NULL,
    "supplyType" "GstSupplyType" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'FINAL',
    "taxableValuePaise" INTEGER NOT NULL,
    "gstRatePercent" INTEGER NOT NULL,
    "cgstPaise" INTEGER NOT NULL DEFAULT 0,
    "sgstPaise" INTEGER NOT NULL DEFAULT 0,
    "igstPaise" INTEGER NOT NULL DEFAULT 0,
    "totalTaxPaise" INTEGER NOT NULL,
    "totalPayablePaise" INTEGER NOT NULL,
    "providerReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductPlan_code_isActive_idx" ON "ProductPlan"("code", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPlan_code_version_key" ON "ProductPlan"("code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_providerOrderId_key" ON "Purchase"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_providerPaymentId_key" ON "Purchase"("providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_idempotencyKey_key" ON "Purchase"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Purchase_organisationId_status_createdAt_idx" ON "Purchase"("organisationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Purchase_purchaserUserId_createdAt_idx" ON "Purchase"("purchaserUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Purchase_productCode_status_idx" ON "Purchase"("productCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySubscription_purchaseId_key" ON "CompanySubscription"("purchaseId");

-- CreateIndex
CREATE INDEX "CompanySubscription_organisationId_status_idx" ON "CompanySubscription"("organisationId", "status");

-- CreateIndex
CREATE INDEX "CompanySubscription_status_expiresAt_idx" ON "CompanySubscription"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobPostingCreditLedger_idempotencyKey_key" ON "JobPostingCreditLedger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "JobPostingCreditLedger_organisationId_createdAt_idx" ON "JobPostingCreditLedger"("organisationId", "createdAt");

-- CreateIndex
CREATE INDEX "JobPostingCreditLedger_organisationId_entryType_expiresAt_idx" ON "JobPostingCreditLedger"("organisationId", "entryType", "expiresAt");

-- CreateIndex
CREATE INDEX "JobPostingCreditLedger_jobId_idx" ON "JobPostingCreditLedger"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_dedupeKey_key" ON "PaymentWebhookEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_provider_eventType_receivedAt_idx" ON "PaymentWebhookEvent"("provider", "eventType", "receivedAt");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_relatedPurchaseId_idx" ON "PaymentWebhookEvent"("relatedPurchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyBillingProfile_organisationId_key" ON "CompanyBillingProfile"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_purchaseId_key" ON "Invoice"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_organisationId_invoiceDate_idx" ON "Invoice"("organisationId", "invoiceDate");

-- CreateIndex
CREATE INDEX "Invoice_organisationId_status_idx" ON "Invoice"("organisationId", "status");

-- CreateIndex
CREATE INDEX "Job_status_activeUntil_idx" ON "Job"("status", "activeUntil");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_autoCloseOverrideByUserId_fkey" FOREIGN KEY ("autoCloseOverrideByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_purchaserUserId_fkey" FOREIGN KEY ("purchaserUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_productPlanId_fkey" FOREIGN KEY ("productPlanId") REFERENCES "ProductPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySubscription" ADD CONSTRAINT "CompanySubscription_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySubscription" ADD CONSTRAINT "CompanySubscription_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPostingCreditLedger" ADD CONSTRAINT "JobPostingCreditLedger_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPostingCreditLedger" ADD CONSTRAINT "JobPostingCreditLedger_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPostingCreditLedger" ADD CONSTRAINT "JobPostingCreditLedger_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "CompanySubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPostingCreditLedger" ADD CONSTRAINT "JobPostingCreditLedger_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPostingCreditLedger" ADD CONSTRAINT "JobPostingCreditLedger_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_relatedPurchaseId_fkey" FOREIGN KEY ("relatedPurchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyBillingProfile" ADD CONSTRAINT "CompanyBillingProfile_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyBillingProfile" ADD CONSTRAINT "CompanyBillingProfile_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
