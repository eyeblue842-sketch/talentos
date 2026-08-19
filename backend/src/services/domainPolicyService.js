import { domainToASCII } from 'node:url';
import { prisma } from '../config/db.js';
import { personalEmailDomains } from '../utils/email.js';

// CAREERIZ EMPLOYER ACCESS: the single, authoritative, server-side source
// of truth for email/domain decisions used at employer registration. The
// frontend must never duplicate these lists - it only does generic
// email-format validation for UX; every rejection shown to a user must
// trace back to a code returned from this module. See
// employerOnboardingService.js for how registration/OAuth consume it.

// Reviewed, hand-maintained list of disposable/temporary-mail providers.
// Add/remove entries here only - this is the single list backend-wide.
const disposableEmailDomains = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.info',
  'guerrillamail.biz',
  'guerrillamail.de',
  'sharklasers.com',
  'grr.la',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  '10minutemail.com',
  '10minutemail.net',
  '20minutemail.com',
  'throwawaymail.com',
  'trashmail.com',
  'trashmail.net',
  'getnada.com',
  'dispostable.com',
  'fakeinbox.com',
  'maildrop.cc',
  'mailnesia.com',
  'mintemail.com',
  'mytemp.email',
  'moakt.com',
  'discard.email',
  'discardmail.com',
  'spamgourmet.com',
  'emailondeck.com',
  'mohmal.com',
  'tempinbox.com',
  'tempr.email',
  'burnermail.io',
  'inboxbear.com',
  'anonaddy.com',
  'crazymailing.com',
  'harakirimail.com',
]);

export const DOMAIN_REJECTION_CODES = {
  INVALID_EMAIL: 'EMAIL_INVALID',
  DISPOSABLE: 'EMAIL_DOMAIN_DISPOSABLE',
  CONSUMER: 'EMAIL_DOMAIN_CONSUMER',
  COMPANY_DOMAIN_CLAIMED: 'EMAIL_DOMAIN_COMPANY_CLAIMED',
};

export const DOMAIN_MATCH_TYPES = {
  EXISTING_VERIFIED_DOMAIN: 'EXISTING_VERIFIED_DOMAIN',
  UNKNOWN_DOMAIN_PENDING_REVIEW: 'UNKNOWN_DOMAIN_PENDING_REVIEW',
};

/**
 * Normalizes an email's domain: lowercase, trimmed, IDN/punycode-safe.
 * Returns '' for anything that isn't shaped like `local@domain`.
 */
export function normalizeEmailDomain(email = '') {
  const raw = String(email || '').toLowerCase().trim();
  const atIndex = raw.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === raw.length - 1) {
    return '';
  }

  const rawDomain = raw.slice(atIndex + 1);
  try {
    const ascii = domainToASCII(rawDomain);
    return ascii || rawDomain;
  } catch {
    return rawDomain;
  }
}

export function isConsumerEmailDomain(domain) {
  return personalEmailDomains.has(domain);
}

export function isDisposableEmailDomain(domain) {
  return disposableEmailDomains.has(domain);
}

/**
 * Normalizes a bare domain string (not an email) the same way
 * normalizeEmailDomain does - lowercase, trimmed, IDN/punycode-safe.
 * Used by the platform-admin reclassification workflow, where a domain is
 * supplied directly rather than derived from a registrant's email.
 */
export function normalizeDomain(domain = '') {
  const raw = String(domain || '').toLowerCase().trim();
  if (!raw || raw.includes('@') || raw.includes(' ')) {
    return '';
  }
  try {
    return domainToASCII(raw) || raw;
  } catch {
    return raw;
  }
}

/**
 * Validates a bare domain for platform-admin COMPANY reclassification:
 * well-formed, not consumer, not disposable, and not already claimed by a
 * DIFFERENT organisation (excludeOrganisationId lets an org keep/re-approve
 * its own domain idempotently). Does not create/modify anything - the
 * caller (organisationVerificationService.js) still relies on the database
 * partial unique index for the final concurrency-safe guarantee.
 */
export async function assertValidUnclaimedCompanyDomain(domain, excludeOrganisationId) {
  const normalized = normalizeDomain(domain);
  if (!normalized) {
    return rejection(DOMAIN_REJECTION_CODES.INVALID_EMAIL, 'A valid business domain is required.', domain);
  }
  if (isDisposableEmailDomain(normalized)) {
    return rejection(DOMAIN_REJECTION_CODES.DISPOSABLE, 'Disposable domains are not valid company domains.', normalized);
  }
  if (isConsumerEmailDomain(normalized)) {
    return rejection(DOMAIN_REJECTION_CODES.CONSUMER, 'Consumer email domains are not valid company domains.', normalized);
  }

  const claimedByAnotherOrganisation = await prisma.organisation.findFirst({
    where: {
      type: 'COMPANY',
      verifiedDomain: normalized,
      ...(excludeOrganisationId ? { id: { not: excludeOrganisationId } } : {}),
    },
    select: { id: true },
  });

  if (claimedByAnotherOrganisation) {
    return rejection(
      DOMAIN_REJECTION_CODES.COMPANY_DOMAIN_CLAIMED,
      'This domain is already claimed by a different organisation.',
      normalized,
    );
  }

  return { ok: true, domain: normalized };
}

function rejection(code, message, domain) {
  return { ok: false, code, message, domain };
}

/**
 * Consultancy Recruiter policy: business, Gmail, and other personal email
 * are all permitted. Only disposable/temporary providers are rejected -
 * WITH one exception (domain-ownership closure section 3): a BUSINESS
 * (non-consumer) domain that is already claimed by a COMPANY organisation
 * (PENDING or VERIFIED - a claim under review is still a claim) cannot be
 * used to spin up an unrelated Consultancy organisation for the same
 * company. A consumer/personal domain (gmail.com etc.) is never a company's
 * identity, so this check is skipped for those - "allow registration using
 * a verified personal email instead" stays available exactly as intended.
 */
export async function classifyEmailForConsultancy(email) {
  const domain = normalizeEmailDomain(email);
  if (!domain) {
    return rejection(DOMAIN_REJECTION_CODES.INVALID_EMAIL, 'Enter a valid email address.', domain);
  }

  if (isDisposableEmailDomain(domain)) {
    return rejection(
      DOMAIN_REJECTION_CODES.DISPOSABLE,
      'Temporary or disposable email addresses are not allowed. Use a business or personal email address you control.',
      domain,
    );
  }

  if (!isConsumerEmailDomain(domain)) {
    const claimedByCompany = await prisma.organisation.findFirst({
      where: { type: 'COMPANY', verifiedDomain: domain },
      select: { id: true },
    });

    if (claimedByCompany) {
      return rejection(
        DOMAIN_REJECTION_CODES.COMPANY_DOMAIN_CLAIMED,
        'This business domain is already registered as a Company organisation on Careeriz. Ask an administrator there to invite you, or register using a personal email address instead.',
        domain,
      );
    }
  }

  return { ok: true, domain };
}

/**
 * Company Recruiter policy: consumer and disposable domains are rejected.
 * A business domain that already belongs to a verified COMPANY
 * organisation is reported as EXISTING_VERIFIED_DOMAIN (the caller must not
 * silently create a second organisation for it - see
 * employerOnboardingService.js). An unrecognized business domain is
 * reported as UNKNOWN_DOMAIN_PENDING_REVIEW (registration proceeds, but the
 * new organisation starts in PENDING domain-verification status).
 */
export async function classifyEmailForCompany(email) {
  const domain = normalizeEmailDomain(email);
  if (!domain) {
    return rejection(DOMAIN_REJECTION_CODES.INVALID_EMAIL, 'Enter a valid email address.', domain);
  }

  if (isDisposableEmailDomain(domain)) {
    return rejection(
      DOMAIN_REJECTION_CODES.DISPOSABLE,
      'Temporary or disposable email addresses are not allowed.',
      domain,
    );
  }

  if (isConsumerEmailDomain(domain)) {
    return rejection(
      DOMAIN_REJECTION_CODES.CONSUMER,
      'Company Recruiter accounts require a verified official company email address. If your company domain is not recognized, request verification.',
      domain,
    );
  }

  const existingCompanyOrganisation = await prisma.organisation.findFirst({
    where: { type: 'COMPANY', verifiedDomain: domain },
    select: { id: true, domainVerificationStatus: true },
  });

  if (existingCompanyOrganisation) {
    return {
      ok: true,
      domain,
      matchedOrganisationId: existingCompanyOrganisation.id,
      matchType: DOMAIN_MATCH_TYPES.EXISTING_VERIFIED_DOMAIN,
    };
  }

  return {
    ok: true,
    domain,
    matchedOrganisationId: null,
    matchType: DOMAIN_MATCH_TYPES.UNKNOWN_DOMAIN_PENDING_REVIEW,
  };
}
