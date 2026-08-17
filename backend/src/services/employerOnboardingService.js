import slugify from 'slugify';
import { prisma } from '../config/db.js';
import {
  classifyEmailForCompany,
  classifyEmailForConsultancy,
  normalizeEmailDomain,
  DOMAIN_MATCH_TYPES,
} from './domainPolicyService.js';

// CAREERIZ EMPLOYER ACCESS: the one place both the direct signup path
// (authService.registerUser) and the OAuth path (oauthService) go through
// to decide what organisation a new recruiter ends up in. Keeping this
// logic in one module is what makes "a Gmail address does not grant
// automatic company-recruiter status" and "organisation type cannot be
// changed by editing a request payload" true by construction: employerType
// only ever selects which domainPolicyService check runs, and the actual
// `type`/`verifiedDomain` written to the database always comes from the
// server-computed classification result, never from client input.

const supportedEmployerTypes = new Set(['CONSULTANCY', 'COMPANY']);

export function normalizeEmployerType(value) {
  return supportedEmployerTypes.has(value) ? value : null;
}

// `client` defaults to the shared prisma singleton but MUST be the active
// transaction handle (`tx`) when called from inside a $transaction callback
// - querying through a different client while a transaction is open
// competes for a separate connection-pool slot and can exhaust the pool
// under concurrency (this was caught for real running the disposable-
// database concurrency script for section 8, not merely theorized).
export async function buildUniqueOrganisationSlug(baseValue, client = prisma) {
  const base = slugify(baseValue, { lower: true, strict: true }) || `org-${Date.now()}`;
  let slug = base;
  let counter = 1;

  while (await client.organisation.findUnique({ where: { slug } })) {
    counter += 1;
    slug = `${base}-${counter}`;
  }

  return slug;
}

/**
 * Validates `email` against the domain policy for `employerType`. Throws a
 * client-facing error (statusCode + stable `code`) on rejection, including
 * when a COMPANY email domain already belongs to a different verified
 * organisation (a recruiter must be invited into that organisation, not
 * auto-create a second one for the same domain). Returns the classification
 * result on success.
 */
export async function assertEmailAllowedForEmployerType(email, employerType) {
  const type = normalizeEmployerType(employerType);
  if (!type) {
    const error = new Error('A valid employer account type (Consultancy Recruiter or Company Recruiter) is required.');
    error.statusCode = 422;
    error.code = 'EMPLOYER_TYPE_REQUIRED';
    throw error;
  }

  const classification = type === 'CONSULTANCY'
    ? await classifyEmailForConsultancy(email)
    : await classifyEmailForCompany(email);

  if (!classification.ok) {
    const error = new Error(classification.message);
    error.statusCode = 422;
    error.code = classification.code;
    throw error;
  }

  if (type === 'COMPANY' && classification.matchType === DOMAIN_MATCH_TYPES.EXISTING_VERIFIED_DOMAIN) {
    const error = new Error(
      'An organisation for this company domain already exists. Ask an administrator at your company to invite you instead of creating a new account.'
    );
    error.statusCode = 409;
    error.code = 'EMAIL_DOMAIN_ALREADY_CLAIMED';
    throw error;
  }

  return { type, ...classification };
}

/**
 * Builds the Organisation.create() data for a brand-new recruiter
 * organisation from an already-asserted classification result. Never call
 * this without first calling assertEmailAllowedForEmployerType - the
 * verifiedDomain/domainVerificationStatus values it writes come entirely
 * from the classification, not from caller-supplied fields.
 */
export async function buildRecruiterOrganisationCreateData({ email, companyName, website }, classification, client = prisma) {
  const domain = classification.domain || normalizeEmailDomain(email);
  const inferredName = companyName?.trim() || domain.split('.')[0] || 'New organisation';

  return {
    name: inferredName,
    slug: await buildUniqueOrganisationSlug(inferredName, client),
    website: website || null,
    type: classification.type,
    verifiedDomain: classification.type === 'COMPANY' ? domain : null,
    domainVerificationStatus: classification.type === 'COMPANY' ? 'PENDING' : 'NOT_APPLICABLE',
  };
}

function p2002TargetText(dbError) {
  const target = dbError?.meta?.target;
  const targetText = Array.isArray(target) ? target.join(',') : String(target || '');
  // Prisma's exact `meta.target` shape for a hand-written partial unique
  // INDEX (as opposed to a `@unique` column) has been observed to vary -
  // fall back to the error message text too, which Prisma always includes
  // the field/constraint name in ("Unique constraint failed on the
  // fields: (`verifiedDomain`)" or similar).
  return `${targetText} ${dbError?.message || ''}`;
}

function isSlugUniqueViolation(dbError) {
  if (dbError?.code !== 'P2002') return false;
  return /\bslug\b/.test(p2002TargetText(dbError));
}

/**
 * Creates the new recruiter organisation inside the caller's transaction
 * (`tx`). This is the ONLY safety net that actually matters under
 * concurrency: the pre-check in assertEmailAllowedForEmployerType is a
 * courtesy that avoids the round trip in the common case, but two requests
 * can both pass it before either commits - the database's partial unique
 * index on Organisation.verifiedDomain (migration
 * 20260817150000_employer_domain_uniqueness) is what actually guarantees
 * only one of them succeeds. On conflict, always resolves to ONE stable
 * public result regardless of which constraint the database happened to
 * report (domain-ownership closure section 3) - see the in-function
 * comment for why a naive per-constraint error mapping is not reliable
 * under real concurrency.
 */
function throwDomainClaimedError() {
  const error = new Error(
    'An organisation for this company domain already exists. Ask an administrator at your company to invite you instead of creating a new account.'
  );
  error.statusCode = 409;
  error.code = 'EMAIL_DOMAIN_ALREADY_CLAIMED';
  throw error;
}

export async function createRecruiterOrganisation(tx, organisationData) {
  try {
    return await tx.organisation.create({ data: organisationData });
  } catch (dbError) {
    if (dbError?.code !== 'P2002') {
      throw dbError;
    }

    // Final publication-bypass closure section 3: the raw P2002 alone does
    // not reliably tell us WHICH constraint a losing transaction hit first
    // under real concurrency - Postgres does not guarantee constraint-check
    // order between simultaneous inserts, so isCompanyDomainUniqueViolation
    // matching (or not) on this exact error is not a stable signal by
    // itself. Once ANY unique conflict happens on a COMPANY create, the
    // AUTHORITATIVE re-check is: does a COMPANY organisation for this exact
    // domain exist right now? If yes, every loser in that race - regardless
    // of whether ITS error happened to be reported as a slug or a domain
    // conflict - gets the identical, stable EMAIL_DOMAIN_ALREADY_CLAIMED
    // result. This re-check MUST use the outer `prisma` client, not `tx`:
    // once a statement inside a Postgres transaction errors, the whole
    // transaction is aborted and refuses further commands (25P02) without a
    // SAVEPOINT, which Prisma's interactive transactions do not expose. By
    // the time we observe the P2002 at all, the winning transaction has
    // necessarily already committed (Postgres only reports a unique
    // conflict against a committed row), so the outer client is guaranteed
    // to see it under READ COMMITTED - no race in this check itself.
    if (organisationData.type === 'COMPANY' && organisationData.verifiedDomain) {
      const claimed = await prisma.organisation.findFirst({
        where: { type: 'COMPANY', verifiedDomain: organisationData.verifiedDomain },
        select: { id: true },
      });
      if (claimed) {
        throwDomainClaimedError();
      }
    }

    // Not a domain conflict - a genuine, unrelated slug collision (two
    // different registrations happening to share an inferred organisation
    // name, e.g. CONSULTANCY registrations, or a COMPANY domain that turned
    // out NOT to be contested after all). Translated into its own stable,
    // non-crashing, non-leaking error rather than a raw database message.
    // In-place retry is not attempted for the same 25P02/no-SAVEPOINT
    // reason described above - the caller would need to resubmit.
    if (isSlugUniqueViolation(dbError)) {
      const error = new Error('This organisation name is temporarily unavailable. Please try again.');
      error.statusCode = 409;
      error.code = 'ORGANISATION_SLUG_CONFLICT';
      throw error;
    }

    throw dbError;
  }
}
