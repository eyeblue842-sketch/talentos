import { isFeatureEnabled } from '@/lib/feature-flags';

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getResumeSearchV2Allowlists() {
  return {
    userIds: splitCsv(process.env.RESUME_SEARCH_V2_ALLOWED_USER_IDS),
    organisationIds: splitCsv(process.env.RESUME_SEARCH_V2_ALLOWED_ORG_IDS),
  };
}

export function isResumeSearchV2RolloutEnabledForServer({ user, organisation } = {}) {
  if (!isFeatureEnabled('resumeSearchV2')) {
    return false;
  }

  if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
    return true;
  }

  const { userIds, organisationIds } = getResumeSearchV2Allowlists();
  if (!userIds.length && !organisationIds.length) {
    return false;
  }

  const organisationId = organisation?.id || user?.activeMembership?.organisationId || null;
  return Boolean(
    (user?.id && userIds.includes(user.id))
    || (organisationId && organisationIds.includes(organisationId))
  );
}
