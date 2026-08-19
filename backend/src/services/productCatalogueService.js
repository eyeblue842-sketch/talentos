import { prisma } from '../config/db.js';
import { env } from '../config/env.js';

// Server-authoritative product catalogue (section 2/3 of the billing spec).
// This is the ONLY place prices, GST and benefits are defined - the
// ProductPlan table is seeded from this array and every purchase/order/
// entitlement calculation reads from the DB row (never from the client,
// never from this array directly at runtime), so a price change here only
// takes effect after a new ProductPlan version is seeded, and historical
// Purchases keep whatever snapshot they were created with.
export const CATALOGUE_DEFINITIONS = [
  {
    code: 'JOB_POST_45D',
    version: 1,
    name: 'Single Job Posting',
    description: 'One job-posting credit. Activates exactly one job for 45 days from server-recorded activation.',
    baseAmountPaise: 150000,
    gstRatePercent: 18,
    gstAmountPaise: 27000,
    totalAmountPaise: 177000,
    durationMonths: null,
    includedJobCredits: 1,
    jobActiveDays: 45,
    razorpayButtonId: env.razorpayButtonIds.JOB_POST_45D,
  },
  {
    code: 'ATS_DB_1M',
    version: 1,
    name: 'ATS + Resume Database - Monthly',
    description: 'ATS and resume-database access for one calendar month. No included job-posting credits.',
    baseAmountPaise: 1000000,
    gstRatePercent: 18,
    gstAmountPaise: 180000,
    totalAmountPaise: 1180000,
    durationMonths: 1,
    includedJobCredits: 0,
    jobActiveDays: 45,
    razorpayButtonId: env.razorpayButtonIds.ATS_DB_1M,
  },
  {
    code: 'ATS_DB_6M',
    version: 1,
    name: 'ATS + Resume Database - 6 Months',
    description: 'ATS and resume-database access for six calendar months, with three included job-posting credits.',
    baseAmountPaise: 5000000,
    gstRatePercent: 18,
    gstAmountPaise: 900000,
    totalAmountPaise: 5900000,
    durationMonths: 6,
    includedJobCredits: 3,
    jobActiveDays: 45,
    razorpayButtonId: env.razorpayButtonIds.ATS_DB_6M,
  },
  {
    code: 'ATS_DB_12M',
    version: 1,
    name: 'ATS + Resume Database - Annual',
    description: 'ATS and resume-database access for twelve calendar months, with five included job-posting credits.',
    baseAmountPaise: 10000000,
    gstRatePercent: 18,
    gstAmountPaise: 1800000,
    totalAmountPaise: 11800000,
    durationMonths: 12,
    includedJobCredits: 5,
    jobActiveDays: 45,
    razorpayButtonId: env.razorpayButtonIds.ATS_DB_12M,
  },
];

function assertGstMath(definition) {
  const expectedGst = Math.round((definition.baseAmountPaise * definition.gstRatePercent) / 100);
  const expectedTotal = definition.baseAmountPaise + definition.gstAmountPaise;
  if (expectedGst !== definition.gstAmountPaise || expectedTotal !== definition.totalAmountPaise) {
    throw new Error(`Catalogue definition for ${definition.code} v${definition.version} has inconsistent GST math.`);
  }
}

const COMMERCIAL_FIELDS = ['baseAmountPaise', 'gstRatePercent', 'gstAmountPaise', 'totalAmountPaise', 'durationMonths', 'includedJobCredits', 'jobActiveDays'];

function commercialTermsChanged(existing, definition) {
  return COMMERCIAL_FIELDS.some((field) => existing[field] !== definition[field]);
}

// B1 hardening, section 10: this is NOT called automatically at server
// boot (that was an uncontrolled write on every instance start - see
// scripts/sync-product-catalogue.js and the "catalogue:sync" npm script
// for the deliberate, explicit, operator-run replacement). Idempotent and
// concurrency-safe (Prisma upsert on the code+version unique key is a
// single atomic INSERT ... ON CONFLICT at the DB level, so N instances
// running this concurrently cannot race into duplicate/corrupt rows) - but
// safety here means more than "doesn't crash": once a (code, version) row
// exists, its COMMERCIAL terms (price/GST/duration/credits) are treated as
// immutable. If CATALOGUE_DEFINITIONS is edited without bumping `version`,
// this throws instead of silently overwriting a price that live Purchases
// may already reference by productPlanId - the fix is always a new
// version, never an edit in place. Only cosmetic fields (name/description/
// razorpayButtonId/isActive) may be refreshed on an existing version.
export async function ensureProductCatalogueSeeded() {
  for (const definition of CATALOGUE_DEFINITIONS) {
    assertGstMath(definition);

    const existing = await prisma.productPlan.findUnique({
      where: { code_version: { code: definition.code, version: definition.version } },
    });

    if (existing) {
      if (commercialTermsChanged(existing, definition)) {
        throw new Error(
          `Refusing to sync ProductPlan ${definition.code} v${definition.version}: commercial terms changed in `
          + `CATALOGUE_DEFINITIONS without a version bump. Existing purchases may already reference this exact `
          + `version's price/GST/duration/credits - increment "version" for ${definition.code} to publish a new price.`,
        );
      }
      await prisma.productPlan.update({
        where: { code_version: { code: definition.code, version: definition.version } },
        data: {
          name: definition.name,
          description: definition.description,
          razorpayButtonId: definition.razorpayButtonId,
          isActive: true,
        },
      });
      continue;
    }

    await prisma.productPlan.create({
      data: {
        code: definition.code,
        version: definition.version,
        name: definition.name,
        description: definition.description,
        currency: 'INR',
        baseAmountPaise: definition.baseAmountPaise,
        gstRatePercent: definition.gstRatePercent,
        gstAmountPaise: definition.gstAmountPaise,
        totalAmountPaise: definition.totalAmountPaise,
        durationMonths: definition.durationMonths,
        includedJobCredits: definition.includedJobCredits,
        jobActiveDays: definition.jobActiveDays,
        razorpayButtonId: definition.razorpayButtonId,
        isActive: true,
      },
    }).catch((error) => {
      // P2002 (unique constraint) here means another instance's concurrent
      // `create` won the race for this exact (code, version) - that is the
      // expected, safe outcome of running this across multiple instances,
      // not an error.
      if (error?.code !== 'P2002') throw error;
    });
  }
}

export async function getActiveProductPlan(code) {
  return prisma.productPlan.findFirst({
    where: { code, isActive: true },
    orderBy: { version: 'desc' },
  });
}

export async function getProductCatalogue() {
  const plans = await prisma.productPlan.findMany({
    where: { isActive: true },
    orderBy: [{ code: 'asc' }, { version: 'desc' }],
  });

  const latestByCode = new Map();
  for (const plan of plans) {
    if (!latestByCode.has(plan.code)) {
      latestByCode.set(plan.code, plan);
    }
  }

  return Array.from(latestByCode.values());
}

export function isSubscriptionProduct(code) {
  return code !== 'JOB_POST_45D';
}

export function buildProductSnapshot(plan) {
  return {
    productPlanId: plan.id,
    code: plan.code,
    version: plan.version,
    name: plan.name,
    description: plan.description,
    currency: plan.currency,
    baseAmountPaise: plan.baseAmountPaise,
    gstRatePercent: plan.gstRatePercent,
    gstAmountPaise: plan.gstAmountPaise,
    totalAmountPaise: plan.totalAmountPaise,
    durationMonths: plan.durationMonths,
    includedJobCredits: plan.includedJobCredits,
    jobActiveDays: plan.jobActiveDays,
  };
}
