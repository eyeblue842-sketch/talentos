import { isOrganisationVerificationEnforcementEnabled } from './employerOrganisationVerificationRolloutService.js';

// CAREERIZ EMPLOYER ACCESS, final publication-bypass closure section 1/2:
// the ONE decision function behind both the route middleware
// (middleware/organisationVerification.js) and every converged
// service-level activation boundary (jobService.activateJobInTransaction,
// and any other multi-entry-point sensitive operation). Route middleware
// alone is not sufficient here - createJob/updateJob both accept `status`
// as an ordinary field of a general payload (matching the existing
// recruiter job form), so "is this request publishing" can only be known
// inside the service, not at the route layer. This function is the single
// place that answers "is this organisation's domain identity verified" -
// call it from every code path that can activate a job or perform another
// protected action, not just from Express routes.
export const ORGANISATION_DOMAIN_VERIFICATION_REQUIRED = 'ORGANISATION_DOMAIN_VERIFICATION_REQUIRED';

/**
 * Throws a stable, client-facing error (statusCode 403, code
 * ORGANISATION_DOMAIN_VERIFICATION_REQUIRED) when `organisation` is a
 * COMPANY stuck in domainVerificationStatus=PENDING AND enforcement is
 * currently on for `organisationId` (global flag or allowlist). A true
 * no-op otherwise - disabled by default, so legacy/CONSULTANCY/VERIFIED
 * organisations and every organisation before enforcement is explicitly
 * turned on are completely unaffected.
 *
 * Call this from inside the transaction/service call that performs the
 * protected action, BEFORE any state-changing write (credit consumption,
 * row creation, etc.) - throwing here inside an active `$transaction`
 * rolls back everything already done in that transaction, so a rejected
 * action never leaves a partial credit debit or partial row behind.
 */
export function assertOrganisationVerifiedForAction(organisation, organisationId) {
  const enforced = isOrganisationVerificationEnforcementEnabled(organisationId);
  if (!enforced || !organisationId) {
    return;
  }

  if (organisation?.type === 'COMPANY' && organisation.domainVerificationStatus === 'PENDING') {
    const error = new Error(
      'This organisation\'s company domain is pending platform verification. This action is unavailable until the domain is verified.'
    );
    error.statusCode = 403;
    error.code = ORGANISATION_DOMAIN_VERIFICATION_REQUIRED;
    throw error;
  }
}
