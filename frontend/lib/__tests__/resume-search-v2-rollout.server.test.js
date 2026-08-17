import { beforeEach, describe, expect, test, vi } from 'vitest';

const isFeatureEnabled = vi.fn((key) => key === 'resumeSearchV2');

vi.mock('@/lib/feature-flags', () => ({
  isFeatureEnabled,
}));

describe('resume search v2 rollout server helper', () => {
  beforeEach(() => {
    vi.resetModules();
    isFeatureEnabled.mockImplementation((key) => key === 'resumeSearchV2');
    process.env.RESUME_SEARCH_V2_ALLOWED_USER_IDS = '';
    process.env.RESUME_SEARCH_V2_ALLOWED_ORG_IDS = '';
  });

  test('allows an explicitly allowlisted organisation', async () => {
    process.env.RESUME_SEARCH_V2_ALLOWED_ORG_IDS = 'org-allowed';
    const { isResumeSearchV2RolloutEnabledForServer } = await import('@/lib/resume-search-v2-rollout.server');
    expect(isResumeSearchV2RolloutEnabledForServer({
      user: { id: 'user-1', role: 'RECRUITER', activeMembership: { organisationId: 'org-other' } },
      organisation: { id: 'org-allowed' },
    })).toBe(true);
  });

  test('denies a disallowed organisation even if the browser could tamper a query value', async () => {
    process.env.RESUME_SEARCH_V2_ALLOWED_ORG_IDS = 'org-allowed';
    const { isResumeSearchV2RolloutEnabledForServer } = await import('@/lib/resume-search-v2-rollout.server');
    expect(isResumeSearchV2RolloutEnabledForServer({
      user: { id: 'user-1', role: 'RECRUITER', activeMembership: { organisationId: 'org-denied' } },
      organisation: { id: 'org-denied' },
      queryOrganisationId: 'org-allowed',
    })).toBe(false);
  });

  test('allows a platform administrator explicitly', async () => {
    const { isResumeSearchV2RolloutEnabledForServer } = await import('@/lib/resume-search-v2-rollout.server');
    expect(isResumeSearchV2RolloutEnabledForServer({
      user: { id: 'admin-1', role: 'ADMIN' },
      organisation: { id: 'org-denied' },
    })).toBe(true);
  });

  test('denies rollout when the global feature flag is disabled', async () => {
    isFeatureEnabled.mockReturnValue(false);
    process.env.RESUME_SEARCH_V2_ALLOWED_ORG_IDS = 'org-allowed';
    const { isResumeSearchV2RolloutEnabledForServer } = await import('@/lib/resume-search-v2-rollout.server');
    expect(isResumeSearchV2RolloutEnabledForServer({
      user: { id: 'user-1', role: 'RECRUITER', activeMembership: { organisationId: 'org-allowed' } },
      organisation: { id: 'org-allowed' },
    })).toBe(false);
  });

  test('denies unauthenticated access even if an allowlist exists', async () => {
    process.env.RESUME_SEARCH_V2_ALLOWED_ORG_IDS = 'org-allowed';
    const { isResumeSearchV2RolloutEnabledForServer } = await import('@/lib/resume-search-v2-rollout.server');
    expect(isResumeSearchV2RolloutEnabledForServer({
      user: null,
      organisation: null,
    })).toBe(false);
  });
});
