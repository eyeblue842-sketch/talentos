import { beforeEach, describe, expect, test, vi } from 'vitest';

const revalidatePathMock = vi.fn();
const updateCandidateProfileMock = vi.fn();
const uploadCandidateProfilePhotoMock = vi.fn();
const removeCandidateProfilePhotoMock = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: (...args) => revalidatePathMock(...args),
}));

vi.mock('@/lib/api', () => ({
  updateCandidateProfile: (...args) => updateCandidateProfileMock(...args),
  uploadCandidateProfilePhoto: (...args) => uploadCandidateProfilePhotoMock(...args),
  removeCandidateProfilePhoto: (...args) => removeCandidateProfilePhotoMock(...args),
  acceptCandidateOfferResponse: vi.fn(),
  applyCandidateResumeParsedUpdates: vi.fn(),
  clearCandidateRecentJobs: vi.fn(),
  getCandidateDataExport: vi.fn(),
  getCandidateApplicationWithdrawal: vi.fn(),
  rejectCandidateOfferResponse: vi.fn(),
  requestCandidateAccountDeactivation: vi.fn(),
  requestCandidateInterviewReschedule: vi.fn(),
  requestCandidateOfferRevisionResponse: vi.fn(),
  saveCandidateOnboarding: vi.fn(),
  saveResumeBuilderLink: vi.fn(),
  markAllCandidateNotificationsRead: vi.fn(),
  markCandidateNotificationRead: vi.fn(),
  saveCandidateJob: vi.fn(),
  unsaveCandidateJob: vi.fn(),
  updateCandidateResumeAssetState: vi.fn(),
  updateCandidateSettings: vi.fn(),
  withdrawCandidateInterviewReschedule: vi.fn(),
  withdrawCandidateApplication: vi.fn(),
}));

const {
  submitCandidateProfileFormAction,
  updateCandidateProfileAction,
} = await import('./actions');

function buildBaseFormData() {
  const formData = new FormData();
  formData.set('activeSection', 'career-profile');
  formData.set('fullName', 'Jane Candidate');
  formData.set('phoneNumber', '+91 9999999999');
  formData.set('headline', '');
  formData.set('currentTitle', '');
  formData.set('currentEmployer', '');
  formData.set('currentDesignation', '');
  formData.set('location', '');
  formData.set('totalExperience', '6');
  formData.set('skills', Array.from({ length: 65 }, (_, index) => `Skill ${index + 1}`).join(', '));
  formData.set('preferredRoles', 'Frontend Engineer, frontend engineer, UI Engineer');
  formData.set('preferredLocations', 'Bengaluru, Remote, bengaluru');
  formData.set('availability', 'ONE_MONTH');
  formData.set('employmentStatus', 'EMPLOYED');
  formData.set('noticePeriodDays', '30');
  formData.set('expectedCtcLpa', '25.5');
  formData.set('profileVisibility', 'RECRUITERS_ONLY');
  formData.set('workplacePreferencesJson', JSON.stringify(['REMOTE', 'HYBRID']));
  formData.set('employmentPreferencesJson', JSON.stringify(['FULL_TIME']));
  formData.set('searchableProfile', 'true');
  formData.set('phoneVisibleToRecruiters', 'false');
  formData.set('salaryVisibleToRecruiters', 'false');
  formData.set('resumeVisibleToRecruiters', 'true');
  formData.set('profilePhotoAction', 'keep');
  return formData;
}

describe('candidate profile actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateCandidateProfileMock.mockResolvedValue({ ok: true });
  });

  test('career profile save submits only normalized career profile fields', async () => {
    const formData = buildBaseFormData();

    await updateCandidateProfileAction(formData);

    expect(updateCandidateProfileMock).toHaveBeenCalledTimes(1);
    expect(updateCandidateProfileMock).toHaveBeenCalledWith({
      preferredRoles: ['Frontend Engineer', 'UI Engineer'],
      preferredLocations: ['Bengaluru', 'Remote'],
      workplacePreferences: ['REMOTE', 'HYBRID'],
      employmentPreferences: ['FULL_TIME'],
      availability: 'ONE_MONTH',
      employmentStatus: 'EMPLOYED',
      noticePeriodDays: 30,
      expectedCtcLpa: 25.5,
      profileVisibility: 'RECRUITERS_ONLY',
    });
  });

  test('profile summary save converts empty optional strings to null', async () => {
    const formData = new FormData();
    formData.set('activeSection', 'profile-summary');
    formData.set('summary', '   ');
    formData.set('portfolioUrl', ' ');
    formData.set('linkedInUrl', '');
    formData.set('githubUrl', '');
    formData.set('profilePhotoAction', 'keep');

    await updateCandidateProfileAction(formData);

    expect(updateCandidateProfileMock).toHaveBeenCalledWith({
      summary: null,
      portfolioUrl: null,
      linkedInUrl: null,
      githubUrl: null,
    });
  });

  test('validation failures keep field errors and replace the generic summary message', async () => {
    updateCandidateProfileMock.mockRejectedValueOnce({
      message: 'Validation failed.',
      details: {
        fieldErrors: {
          preferredRoles: ['Maximum 20 preferred roles allowed.'],
        },
      },
    });

    const result = await submitCandidateProfileFormAction({}, buildBaseFormData());

    expect(result).toEqual({
      status: 'error',
      message: 'Please correct the highlighted fields.',
      fieldErrors: {
        preferredRoles: ['Maximum 20 preferred roles allowed.'],
      },
    });
  });
});
