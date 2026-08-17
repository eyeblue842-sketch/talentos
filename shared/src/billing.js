import { z } from 'zod';

export const billingProductCodeSchema = z.enum([
  'JOB_POST_45D',
  'ATS_DB_1M',
  'ATS_DB_6M',
  'ATS_DB_12M',
]);

export const purchaseStatusSchema = z.enum([
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'CANCELLED',
]);

export const subscriptionStatusSchema = z.enum([
  'PENDING_PAYMENT',
  'ACTIVE',
  'EXPIRING_SOON',
  'EXPIRED',
  'CANCELLED',
  'PAYMENT_FAILED',
  'REFUNDED',
  'SUSPENDED',
]);

// Create a server-side purchase intent + Razorpay Order for the given
// product. This is the ONLY entry point that creates a Razorpay order -
// amount/GST/product details are always resolved server-side from the
// ProductPlan catalogue, never accepted from the client.
export const createPurchaseIntentSchema = z.object({
  productCode: billingProductCodeSchema,
});

// Client-side "fast path" verification after Razorpay Standard Checkout
// closes successfully. This is a defense-in-depth / UX-latency optimisation
// only - the webhook remains the source of truth and this handler must be
// idempotent with it (see billingService.activatePurchase).
export const verifyCheckoutPaymentSchema = z.object({
  purchaseId: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export const companyBillingProfileSchema = z.object({
  legalCompanyName: z.string().trim().min(2).max(200),
  billingEmail: z.string().trim().email(),
  billingPhone: z.string().trim().max(20).optional().nullable(),
  addressLine1: z.string().trim().min(2).max(200),
  addressLine2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  stateCode: z.string().trim().regex(/^[0-9]{2}$/, 'stateCode must be the 2-digit GST state code.'),
  postalCode: z.string().trim().min(3).max(15),
  country: z.string().trim().length(2).default('IN'),
  // GSTIN structure: 2-digit state code + 10-char PAN + 1 entity code +
  // 'Z' (fixed by the GSTIN spec) + 1 checksum character. Full checksum
  // validation is intentionally not implemented (needs the official
  // algorithm and accountant sign-off - see section 9/13), but the fixed
  // 'Z' position and overall shape catch most transcription errors.
  gstin: z.string().trim().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'gstin does not match the standard 15-character GSTIN format.').optional().nullable(),
}).refine(
  (value) => !value.gstin || value.gstin.slice(0, 2) === value.stateCode,
  { message: 'gstin state code (first 2 digits) must match stateCode.', path: ['gstin'] },
);

// Manual, privileged administration actions (section 15). Every one of
// these REQUIRES a human-entered reason and (where relevant) an external
// provider reference - there is deliberately no unrestricted "mark as paid"
// shape here.
export const adminJobCreditAdjustmentSchema = z.object({
  organisationId: z.string().min(1),
  amount: z.number().int().refine((value) => value !== 0, 'amount must be non-zero.'),
  reason: z.string().trim().min(5).max(500),
});

export const adminSubscriptionActionSchema = z.object({
  organisationId: z.string().min(1),
  reason: z.string().trim().min(5).max(500),
});

export const adminManualPurchaseVerifySchema = z.object({
  purchaseId: z.string().min(1),
  providerReference: z.string().trim().min(5).max(200),
  reason: z.string().trim().min(5).max(500),
});

export const adminRefundReviewSchema = z.object({
  purchaseId: z.string().min(1),
  approve: z.boolean(),
  reason: z.string().trim().min(5).max(500),
});

export const jobAutoCloseOverrideSchema = z.object({
  reason: z.string().trim().min(5).max(500),
  extendDays: z.number().int().positive().max(365).optional(),
});

export const billingResendReminderSchema = z.object({
  organisationId: z.string().min(1),
});

export const cancelSubscriptionSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});
