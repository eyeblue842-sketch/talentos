export const RESUME_VISIBILITY_CLASSIFICATIONS = Object.freeze({
  GLOBAL_RECRUITER_DATABASE: 'GLOBAL_RECRUITER_DATABASE',
  ORGANISATION_PRIVATE: 'ORGANISATION_PRIVATE',
  CANDIDATE_PUBLIC: 'CANDIDATE_PUBLIC',
  NOT_SEARCHABLE: 'NOT_SEARCHABLE',
});

export function resolveResumeVisibilityClassification(candidate = {}, resume = null) {
  const searchable = Boolean(candidate.searchableProfile && candidate.resumeVisibleToRecruiters);
  const profileVisibility = candidate.profileVisibility || 'PRIVATE';
  const resumeStatus = resume?.status || 'ACTIVE';
  const explicit = candidate.provenanceMetadata?.resumeSearch?.visibilityClassification || null;

  if (explicit && Object.values(RESUME_VISIBILITY_CLASSIFICATIONS).includes(explicit)) {
    return explicit;
  }
  if (!searchable || ['ARCHIVED', 'DELETED'].includes(resumeStatus) || candidate.profileStatus === 'ARCHIVED') {
    return RESUME_VISIBILITY_CLASSIFICATIONS.NOT_SEARCHABLE;
  }
  if (profileVisibility === 'PUBLIC') {
    return RESUME_VISIBILITY_CLASSIFICATIONS.CANDIDATE_PUBLIC;
  }
  if (profileVisibility === 'PRIVATE') {
    return RESUME_VISIBILITY_CLASSIFICATIONS.ORGANISATION_PRIVATE;
  }
  return RESUME_VISIBILITY_CLASSIFICATIONS.GLOBAL_RECRUITER_DATABASE;
}

export function buildResumeSearchVisibilityFilter({ actorUser, organisationId }) {
  const isPlatformAdmin = ['ADMIN', 'PLATFORM_ADMIN'].includes(actorUser?.role);
  if (isPlatformAdmin) {
    return {
      bool: {
        must_not: [
          { term: { visibilityClassification: RESUME_VISIBILITY_CLASSIFICATIONS.NOT_SEARCHABLE } },
        ],
      },
    };
  }

  return {
    bool: {
      should: [
        { term: { visibilityClassification: RESUME_VISIBILITY_CLASSIFICATIONS.GLOBAL_RECRUITER_DATABASE } },
        { term: { visibilityClassification: RESUME_VISIBILITY_CLASSIFICATIONS.CANDIDATE_PUBLIC } },
        {
          bool: {
            must: [
              { term: { visibilityClassification: RESUME_VISIBILITY_CLASSIFICATIONS.ORGANISATION_PRIVATE } },
              { term: { sourceOrganisationId: organisationId } },
            ],
          },
        },
      ],
      minimum_should_match: 1,
      must_not: [
        { term: { visibilityClassification: RESUME_VISIBILITY_CLASSIFICATIONS.NOT_SEARCHABLE } },
      ],
    },
  };
}

export function hasResumeSearchEntitlement(actorUser) {
  return {
    allowed: Boolean(actorUser?.activeMembership || ['ADMIN', 'PLATFORM_ADMIN'].includes(actorUser?.role)),
    billingHookEnabled: false,
  };
}
