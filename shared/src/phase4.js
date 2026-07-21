import { z } from 'zod';
import {
  availabilityStatusSchema,
  employmentTypeSchema,
  jobVisibilitySchema,
  notificationTypeSchema,
  workplaceTypeSchema,
} from './ats.js';

export const profileVisibilitySchema = z.enum([
  'PRIVATE',
  'RECRUITERS_ONLY',
  'PUBLIC',
]);

export const jobAlertFrequencySchema = z.enum([
  'IMMEDIATE',
  'DAILY',
  'WEEKLY',
  'DISABLED',
]);

export const candidateEmploymentStatusSchema = z.enum([
  'EMPLOYED',
  'OPEN_TO_WORK',
  'UNEMPLOYED',
  'STUDENT',
  'FREELANCER',
  'CAREER_BREAK',
]);

export const resumeAssetStatusSchema = z.enum([
  'ACTIVE',
  'ARCHIVED',
  'DELETED',
]);

export const resumeAssetSourceSchema = z.enum([
  'UPLOAD',
  'EXTERNAL_BUILDER',
]);

export const resumeParseStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'PARTIAL',
  'FAILED',
]);

export const accountLifecycleStatusSchema = z.enum([
  'ACTIVE',
  'DEACTIVATION_REQUESTED',
  'DEACTIVATED',
]);

const stringArrayField = (maxItems = 20, maxLength = 80) =>
  z.preprocess((value) => {
    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }, z.array(z.string().trim().min(1).max(maxLength)).max(maxItems));

const jsonArrayField = (maxItems = 100) => z.preprocess((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    if (!value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value;
    }
  }
  return [];
}, z.array(z.record(z.string(), z.any())).max(maxItems));

const notificationPreferencesSchema = z.object({
  email: z.object({
    applicationUpdates: z.boolean().optional(),
    interviewUpdates: z.boolean().optional(),
    offerUpdates: z.boolean().optional(),
    jobRecommendations: z.boolean().optional(),
    jobAlerts: z.boolean().optional(),
    productAnnouncements: z.boolean().optional(),
    securityAlerts: z.boolean().optional(),
  }).partial().optional(),
  inApp: z.object({
    applicationUpdates: z.boolean().optional(),
    interviewUpdates: z.boolean().optional(),
    offerUpdates: z.boolean().optional(),
    jobRecommendations: z.boolean().optional(),
    jobAlerts: z.boolean().optional(),
    productAnnouncements: z.boolean().optional(),
    securityAlerts: z.boolean().optional(),
  }).partial().optional(),
}).partial();

export const candidateProfileUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phoneNumber: z.string().trim().min(7).max(30).optional().nullable(),
  headline: z.string().trim().min(2).max(160).optional().nullable(),
  currentTitle: z.string().trim().min(2).max(160).optional().nullable(),
  currentEmployer: z.string().trim().min(2).max(160).optional().nullable(),
  currentDesignation: z.string().trim().min(2).max(160).optional().nullable(),
  location: z.string().trim().min(2).max(160).optional().nullable(),
  totalExperience: z.coerce.number().int().min(0).max(60).optional(),
  skills: stringArrayField(50, 80).optional(),
  skillEntries: jsonArrayField(200).optional(),
  experienceEntries: jsonArrayField(200).optional(),
  educationEntries: jsonArrayField(200).optional(),
  certificationEntries: jsonArrayField(200).optional(),
  languageEntries: jsonArrayField(200).optional(),
  projectEntries: jsonArrayField(200).optional(),
  portfolioLinks: jsonArrayField(100).optional(),
  preferredRoles: stringArrayField(20, 120).optional(),
  preferredLocations: stringArrayField(20, 160).optional(),
  workplacePreferences: z.array(workplaceTypeSchema).max(3).optional(),
  employmentPreferences: z.array(employmentTypeSchema).max(4).optional(),
  availability: availabilityStatusSchema.optional(),
  noticePeriodDays: z.coerce.number().int().min(0).max(365).optional().nullable(),
  employmentStatus: candidateEmploymentStatusSchema.optional().nullable(),
  lastWorkingDate: z.string().datetime().optional().nullable().or(z.literal('')),
  currentCtcLpa: z.coerce.number().int().min(0).max(1000).optional().nullable(),
  expectedCtcLpa: z.coerce.number().int().min(0).max(1000).optional().nullable(),
  summary: z.string().trim().max(4000).optional().nullable(),
  profileImageUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  portfolioUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  linkedInUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  githubUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  searchableProfile: z.boolean().optional(),
  phoneVisibleToRecruiters: z.boolean().optional(),
  salaryVisibleToRecruiters: z.boolean().optional(),
  resumeVisibleToRecruiters: z.boolean().optional(),
  profileVisibility: profileVisibilitySchema.optional(),
}).refine((value) => {
  if (
    typeof value.currentCtcLpa === 'number'
    && typeof value.expectedCtcLpa === 'number'
    && value.currentCtcLpa > value.expectedCtcLpa
  ) {
    return false;
  }

  return true;
}, {
  message: 'Expected salary must be greater than or equal to current salary.',
  path: ['expectedCtcLpa'],
});

export const candidateSettingsUpdateSchema = z.object({
  profileVisibility: profileVisibilitySchema.optional(),
  recommendationEnabled: z.boolean().optional(),
  preferredRoles: stringArrayField(20, 120).optional(),
  preferredIndustries: stringArrayField(20, 120).optional(),
  preferredCompanySizes: stringArrayField(10, 80).optional(),
  preferredLocations: stringArrayField(20, 160).optional(),
  willingToRelocate: z.boolean().optional(),
  workplacePreferences: z.array(workplaceTypeSchema).max(3).optional(),
  employmentPreferences: z.array(employmentTypeSchema).max(4).optional(),
  minExpectedSalary: z.coerce.number().int().min(0).max(1000000).optional().nullable(),
  preferredCurrency: z.string().trim().min(3).max(10).optional().nullable().or(z.literal('')),
  noticePeriodDays: z.coerce.number().int().min(0).max(365).optional().nullable(),
  availability: availabilityStatusSchema.optional(),
  workAuthorization: z.string().trim().max(160).optional().nullable().or(z.literal('')),
  requiresVisaSponsorship: z.boolean().optional(),
  travelWillingness: z.string().trim().max(120).optional().nullable().or(z.literal('')),
  jobAlertEnabled: z.boolean().optional(),
  jobAlertFrequency: jobAlertFrequencySchema.optional(),
  notifyForSavedJobUpdates: z.boolean().optional(),
  notifyForApplicationUpdates: z.boolean().optional(),
  notifyForRecommendations: z.boolean().optional(),
  notifyForInterviews: z.boolean().optional(),
  notifyForOffers: z.boolean().optional(),
  notifyForProfileReminders: z.boolean().optional(),
  notifyForMarketing: z.boolean().optional(),
  searchableProfile: z.boolean().optional(),
  phoneVisibleToRecruiters: z.boolean().optional(),
  salaryVisibleToRecruiters: z.boolean().optional(),
  resumeVisibleToRecruiters: z.boolean().optional(),
  notificationPreferences: notificationPreferencesSchema.optional(),
});

export const candidateOnboardingUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phoneNumber: z.string().trim().min(7).max(30).optional().nullable().or(z.literal('')),
  location: z.string().trim().min(2).max(160),
  currentTitle: z.string().trim().min(2).max(160),
  totalExperience: z.coerce.number().int().min(0).max(60),
  primarySkills: stringArrayField(30, 80).optional(),
  employmentStatus: candidateEmploymentStatusSchema.optional().nullable(),
  preferredLocations: stringArrayField(20, 160).optional(),
  workplacePreferences: z.array(workplaceTypeSchema).max(3).optional(),
  noticePeriodDays: z.coerce.number().int().min(0).max(365).optional().nullable(),
  profileVisibility: profileVisibilitySchema.optional(),
  resumeStepAction: z.enum(['UPLOAD', 'SKIP', 'UNCHANGED']).optional(),
  searchableProfile: z.boolean().optional(),
  currentStep: z.coerce.number().int().min(1).max(4).optional(),
});

export const candidateResumeStateUpdateSchema = z.object({
  assetId: z.string().min(1),
  action: z.enum(['SET_PRIMARY', 'ARCHIVE', 'DELETE', 'RESTORE', 'RETRY_PARSE']),
});

export const candidateResumeParseApplySchema = z.object({
  assetId: z.string().min(1),
  acceptAll: z.boolean().optional(),
  fields: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
});

export const candidateAccountDeactivationSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const publicJobSearchQuerySchema = z.object({
  keyword: z.string().trim().max(120).optional(),
  title: z.string().trim().max(120).optional(),
  skills: stringArrayField(10, 80).optional(),
  location: z.string().trim().max(160).optional(),
  employmentType: z.array(employmentTypeSchema).optional().or(employmentTypeSchema.transform((value) => [value])),
  workplaceType: z.array(workplaceTypeSchema).optional().or(workplaceTypeSchema.transform((value) => [value])),
  minExperience: z.coerce.number().int().min(0).max(60).optional(),
  maxExperience: z.coerce.number().int().min(0).max(60).optional(),
  salaryMin: z.coerce.number().int().min(0).max(1000000).optional(),
  salaryMax: z.coerce.number().int().min(0).max(1000000).optional(),
  fresherFriendly: z.coerce.boolean().optional(),
  postedWithinDays: z.coerce.number().int().min(1).max(365).optional(),
  organisation: z.string().trim().max(120).optional(),
  organisationSlug: z.string().trim().regex(/^[a-z0-9-]+$/).optional(),
  sort: z.enum(['relevance', 'newest', 'oldest', 'salary_high', 'closing_date']).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

export const savedJobCreateSchema = z.object({
  jobId: z.string().min(1),
});

export const notificationPageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  unreadOnly: z.coerce.boolean().optional(),
  type: notificationTypeSchema.optional(),
});

export const candidateNotificationReadSchema = z.object({
  notificationId: z.string().min(1),
});

export const candidateApplicationFilterSchema = z.enum([
  'ACTIVE',
  'INTERVIEW',
  'OFFER',
  'CLOSED',
  'WITHDRAWN',
  'ALL',
]);

export const candidateApplicationSortSchema = z.enum([
  'recently_updated',
  'recently_applied',
  'oldest',
  'job_title',
]);

export const candidateApplicationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  filter: candidateApplicationFilterSchema.optional(),
  sort: candidateApplicationSortSchema.optional(),
});

export const candidateApplicationWithdrawSchema = z.object({
  reason: z.enum([
    'ACCEPTED_ANOTHER_OFFER',
    'NO_LONGER_INTERESTED',
    'LOCATION_CONCERN',
    'COMPENSATION_CONCERN',
    'ROLE_MISMATCH',
    'PERSONAL_REASON',
    'OTHER',
  ]).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable().or(z.literal('')),
});

export const candidateSavedJobListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  filter: z.enum(['OPEN', 'CLOSING_SOON', 'CLOSED', 'APPLIED', 'ALL']).optional(),
  sort: z.enum(['recently_saved', 'closing_soon', 'recently_posted', 'job_title']).optional(),
});

export const candidateJobViewCreateSchema = z.object({
  jobId: z.string().min(1),
  source: z.string().trim().max(120).optional(),
  referrerClassification: z.string().trim().max(120).optional(),
});

export const candidateRecentJobListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

export const screeningQuestionTypeSchema = z.enum([
  'YES_NO',
  'SHORT_TEXT',
  'LONG_TEXT',
  'NUMBER',
  'CURRENCY',
  'DATE',
  'EMAIL',
  'PHONE',
  'URL',
  'SINGLE_SELECT',
  'MULTI_SELECT',
  'FILE_UPLOAD',
]);

export const screeningRuleOperatorSchema = z.enum([
  'EQUALS',
  'NOT_EQUALS',
  'LESS_THAN',
  'LESS_THAN_OR_EQUAL',
  'GREATER_THAN',
  'GREATER_THAN_OR_EQUAL',
  'CONTAINS',
  'DOES_NOT_CONTAIN',
  'IN',
  'NOT_IN',
]);

export const screeningOutcomeSchema = z.enum([
  'MEETS_CRITERIA',
  'REVIEW_REQUIRED',
  'DOES_NOT_MEET_CRITERIA',
]);

export const applicationSourceTypeSchema = z.enum([
  'CAREER_PAGE',
  'JOB_BOARD',
  'REFERRAL',
  'DIRECT_LINK',
  'INTERNAL_PORTAL',
  'API',
  'UNKNOWN',
]);

const optionSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  label: z.string().trim().min(1).max(160),
  value: z.string().trim().min(1).max(160),
});

const questionValidationConfigSchema = z.object({
  minTextLength: z.coerce.number().int().min(0).max(10000).optional().nullable(),
  maxTextLength: z.coerce.number().int().min(1).max(10000).optional().nullable(),
  minNumber: z.coerce.number().min(-1000000000).max(1000000000).optional().nullable(),
  maxNumber: z.coerce.number().min(-1000000000).max(1000000000).optional().nullable(),
  allowedCurrency: z.string().trim().min(3).max(10).optional().nullable(),
  allowedFileTypes: z.array(z.string().trim().min(1).max(20)).max(10).optional(),
  maxFileSizeBytes: z.coerce.number().int().min(1).max(25 * 1024 * 1024).optional().nullable(),
  urlValidation: z.boolean().optional(),
  emailValidation: z.boolean().optional(),
  phoneValidation: z.boolean().optional(),
}).partial();

const questionConfigSchema = z.object({
  options: z.array(optionSchema).max(50).optional(),
}).partial();

export const screeningRuleSchema = z.object({
  operator: screeningRuleOperatorSchema,
  value: z.union([
    z.string().trim().min(1).max(500),
    z.number(),
    z.boolean(),
    z.array(z.string().trim().min(1).max(160)).min(1).max(50),
  ]),
  outcome: screeningOutcomeSchema,
  reason: z.string().trim().min(1).max(500),
});

const screeningQuestionInputBaseSchema = z.object({
  templateId: z.string().min(1).optional().nullable(),
  questionText: z.string().trim().min(2).max(500),
  internalLabel: z.string().trim().max(160).optional().nullable(),
  helpText: z.string().trim().max(500).optional().nullable(),
  placeholder: z.string().trim().max(200).optional().nullable(),
  questionType: screeningQuestionTypeSchema,
  required: z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
  config: questionConfigSchema.optional(),
  validationConfig: questionValidationConfigSchema.optional(),
  rules: z.array(screeningRuleSchema).max(10).optional(),
});

function validateScreeningQuestionInput(value, ctx) {
  const options = value.config?.options || [];
  if (['SINGLE_SELECT', 'MULTI_SELECT'].includes(value.questionType) && options.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Select questions require at least two options.',
      path: ['config', 'options'],
    });
  }
  if (!['SINGLE_SELECT', 'MULTI_SELECT'].includes(value.questionType) && options.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Options are only allowed for select questions.',
      path: ['config', 'options'],
    });
  }
  if (value.questionType === 'YES_NO' && (value.validationConfig?.minTextLength || value.validationConfig?.maxTextLength)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Yes/No questions cannot use text-length validation.',
      path: ['validationConfig'],
    });
  }
  if (value.questionType === 'FILE_UPLOAD' && !value.validationConfig?.maxFileSizeBytes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'File upload questions require a maximum file size.',
      path: ['validationConfig', 'maxFileSizeBytes'],
    });
  }
  if (value.validationConfig?.minTextLength != null && value.validationConfig?.maxTextLength != null
    && value.validationConfig.minTextLength > value.validationConfig.maxTextLength) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Minimum text length must not exceed maximum text length.',
      path: ['validationConfig', 'minTextLength'],
    });
  }
  if (value.validationConfig?.minNumber != null && value.validationConfig?.maxNumber != null
    && value.validationConfig.minNumber > value.validationConfig.maxNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Minimum number must not exceed maximum number.',
      path: ['validationConfig', 'minNumber'],
    });
  }
}

export const screeningQuestionInputSchema = screeningQuestionInputBaseSchema.superRefine(validateScreeningQuestionInput);

export const screeningTemplateCreateSchema = screeningQuestionInputBaseSchema.extend({
  required: z.boolean().optional(),
  isRequiredByDefault: z.boolean().optional(),
}).superRefine(validateScreeningQuestionInput);

export const screeningTemplateUpdateSchema = screeningQuestionInputBaseSchema.extend({
  required: z.boolean().optional(),
  isRequiredByDefault: z.boolean().optional(),
}).partial().superRefine(validateScreeningQuestionInput);

export const screeningTemplateArchiveSchema = z.object({
  isActive: z.boolean(),
});

export const screeningTemplateListQuerySchema = z.object({
  search: z.string().trim().max(160).optional(),
  questionType: screeningQuestionTypeSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const jobScreeningQuestionUpdateSchema = screeningQuestionInputBaseSchema.partial().superRefine(validateScreeningQuestionInput);

export const jobScreeningQuestionReorderSchema = z.object({
  questionIds: z.array(z.string().min(1)).min(1).max(200),
});

export const jobQuestionAddFromLibrarySchema = z.object({
  templateId: z.string().min(1),
});

export const publicJobEligibilityQuerySchema = z.object({
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(120).optional(),
  utmTerm: z.string().trim().max(120).optional(),
  utmContent: z.string().trim().max(120).optional(),
  sourceType: applicationSourceTypeSchema.optional(),
  sourceName: z.string().trim().max(120).optional(),
  sourceCampaign: z.string().trim().max(120).optional(),
  directLinkIdentifier: z.string().trim().max(120).optional(),
});

export const applicationAnswerInputSchema = z.object({
  questionId: z.string().min(1),
  value: z.any().optional(),
  fileAssetId: z.string().min(1).optional().nullable(),
});

export const submitJobApplicationSchema = z.object({
  jobId: z.string().min(1),
  resumeAssetId: z.string().min(1),
  answers: z.array(applicationAnswerInputSchema).max(200),
  consentAccepted: z.literal(true),
  privacyAccepted: z.literal(true),
  termsAccepted: z.literal(true),
  source: z.object({
    sourceType: applicationSourceTypeSchema.optional(),
    sourceName: z.string().trim().max(120).optional(),
    sourceCampaign: z.string().trim().max(120).optional(),
    utmSource: z.string().trim().max(120).optional(),
    utmMedium: z.string().trim().max(120).optional(),
    utmCampaign: z.string().trim().max(120).optional(),
    utmTerm: z.string().trim().max(120).optional(),
    utmContent: z.string().trim().max(120).optional(),
    referrer: z.string().trim().max(300).optional(),
    directLinkIdentifier: z.string().trim().max(120).optional(),
  }).optional(),
});

export const validateJobApplicationAnswersSchema = z.object({
  jobId: z.string().min(1),
  answers: z.array(applicationAnswerInputSchema).max(200),
});

export const jobApplicationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  jobId: z.string().min(1).optional(),
  status: z.string().trim().max(80).optional(),
  screeningOutcome: screeningOutcomeSchema.optional(),
  hasFlags: z.coerce.boolean().optional(),
  sort: z.enum(['submittedAt', 'updatedAt']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
});

export const secureResumeAccessQuerySchema = z.object({
  applicationId: z.string().min(1).optional(),
});

export const recruiterJobQuestionPreviewSchema = z.object({
  questions: z.array(screeningQuestionInputSchema).max(200),
  visibility: jobVisibilitySchema.optional(),
});
