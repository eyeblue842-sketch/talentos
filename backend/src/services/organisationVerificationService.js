import { prisma } from '../config/db.js';
import { serializeOrganisation } from '../serializers/index.js';
import { recordAuditLog } from './auditLogService.js';
import { normalizeEmployerType } from './employerOnboardingService.js';
import { assertValidUnclaimedCompanyDomain } from './domainPolicyService.js';

function isCompanyDomainUniqueViolation(dbError) {
  if (dbError?.code !== 'P2002') return false;
  const target = dbError?.meta?.target;
  const targetText = Array.isArray(target) ? target.join(',') : String(target || '');
  const haystack = `${targetText} ${dbError?.message || ''}`;
  return haystack.includes('verifiedDomain') || haystack.includes('Organisation_company_verified_domain_key');
}

function throwDomainClaimedError() {
  const error = new Error('This domain is already claimed by a different organisation.');
  error.statusCode = 409;
  error.code = 'EMAIL_DOMAIN_ALREADY_CLAIMED';
  throw error;
}

// CAREERIZ EMPLOYER ACCESS: the only place an organisation's `type` or
// `domainVerificationStatus` can change after creation. Both actions are
// platform-admin-only (see adminOrganisationVerificationRoutes.js) and
// always write an AuditLog row - "Organization-type changes require an
// authorized admin workflow and audit record" (spec section 2). Existing
// organisations are never touched by any other code path in this feature,
// so they stay unclassified (type = null) until a reviewer explicitly acts.

async function getOrganisationOr404(organisationId) {
  const organisation = await prisma.organisation.findUnique({ where: { id: organisationId } });
  if (!organisation) {
    const error = new Error('Organisation not found.');
    error.statusCode = 404;
    throw error;
  }
  return organisation;
}

export async function listPendingDomainVerifications() {
  const organisations = await prisma.organisation.findMany({
    where: { type: 'COMPANY', domainVerificationStatus: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });
  return organisations.map(serializeOrganisation);
}

export async function approveDomainVerification(actorUser, organisationId, requestMeta = {}) {
  const existing = await getOrganisationOr404(organisationId);
  if (existing.type !== 'COMPANY') {
    const error = new Error('Only COMPANY organisations have a domain to verify.');
    error.statusCode = 422;
    throw error;
  }

  // Admin approval invariants (domain-ownership closure section 4): the
  // status flip and its audit record commit together or not at all
  // (wrapped in a transaction), and the WHERE clause re-checks type='COMPANY'
  // at write time - if the organisation was concurrently reclassified away
  // from COMPANY between the read above and this write, updateMany matches
  // zero rows and the approval safely fails instead of silently verifying a
  // (no longer) COMPANY organisation's stale domain.
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.organisation.updateMany({
      where: { id: organisationId, type: 'COMPANY' },
      data: { domainVerificationStatus: 'VERIFIED' },
    });

    if (result.count !== 1) {
      const error = new Error('This organisation is no longer a COMPANY organisation - approval aborted.');
      error.statusCode = 409;
      throw error;
    }

    const refreshed = await tx.organisation.findUnique({ where: { id: organisationId } });

    await recordAuditLog({
      organisationId,
      actorUserId: actorUser.id,
      action: 'organisation.domain_verification.approve',
      entityType: 'Organisation',
      entityId: organisationId,
      beforeData: { domainVerificationStatus: existing.domainVerificationStatus, verifiedDomain: existing.verifiedDomain },
      afterData: { domainVerificationStatus: refreshed.domainVerificationStatus, verifiedDomain: refreshed.verifiedDomain },
      ...requestMeta,
    }, tx);

    return refreshed;
  });

  return serializeOrganisation(updated);
}

/**
 * Reclassifies (or classifies for the first time) an organisation's
 * employer type. Platform-admin only. Never invoked automatically by any
 * registration or login path - existing organisations keep whatever type
 * (including null/unset) they already have unless a reviewer explicitly
 * calls this.
 */
export async function reclassifyOrganisationType(actorUser, organisationId, payload, requestMeta = {}) {
  const type = normalizeEmployerType(payload.type);
  if (!type) {
    const error = new Error('type must be CONSULTANCY or COMPANY.');
    error.statusCode = 422;
    throw error;
  }

  const existing = await getOrganisationOr404(organisationId);

  let nextVerifiedDomain = null;
  let nextDomainVerificationStatus = 'NOT_APPLICABLE';

  if (type === 'COMPANY') {
    // CONSULTANCY -> COMPANY (or re-affirming COMPANY) requires a valid,
    // unclaimed business domain - never trusted verbatim from the request
    // (domain-ownership closure section 4). excludeOrganisationId lets this
    // organisation keep/re-affirm its OWN existing domain idempotently.
    const requestedDomain = payload.verifiedDomain || existing.verifiedDomain;
    const domainCheck = await assertValidUnclaimedCompanyDomain(requestedDomain, organisationId);
    if (!domainCheck.ok) {
      const error = new Error(domainCheck.message);
      error.statusCode = 422;
      error.code = domainCheck.code;
      throw error;
    }

    nextVerifiedDomain = domainCheck.domain;
    // Only a same-domain COMPANY->COMPANY reclassification (e.g. updating
    // the audit reason only) preserves an already-VERIFIED status. Any
    // actual domain change, or arriving at COMPANY from a different type,
    // always starts PENDING - "unless explicitly approved through the
    // authorized transaction" (approveDomainVerification, called
    // separately). This is never auto-verified here.
    const domainUnchanged = existing.type === 'COMPANY' && existing.verifiedDomain === nextVerifiedDomain;
    nextDomainVerificationStatus = domainUnchanged ? existing.domainVerificationStatus : 'PENDING';
  }

  const updated = await prisma.$transaction(async (tx) => {
    let result;
    try {
      result = await tx.organisation.update({
        where: { id: organisationId },
        data: {
          type,
          verifiedDomain: nextVerifiedDomain,
          domainVerificationStatus: nextDomainVerificationStatus,
        },
      });
    } catch (dbError) {
      if (isCompanyDomainUniqueViolation(dbError)) {
        throwDomainClaimedError();
      }
      throw dbError;
    }

    await recordAuditLog({
      organisationId,
      actorUserId: actorUser.id,
      action: 'organisation.type.reclassify',
      entityType: 'Organisation',
      entityId: organisationId,
      beforeData: { type: existing.type, domainVerificationStatus: existing.domainVerificationStatus, verifiedDomain: existing.verifiedDomain },
      afterData: { type: result.type, domainVerificationStatus: result.domainVerificationStatus, verifiedDomain: result.verifiedDomain },
      metadata: payload.reason ? { reason: payload.reason } : undefined,
      ...requestMeta,
    }, tx);

    return result;
  });

  return serializeOrganisation(updated);
}
