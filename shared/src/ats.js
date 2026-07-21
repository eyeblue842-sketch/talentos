import { z } from 'zod';

export const pipelineStageSchema = z.enum([
  'APPLIED',
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'SELECTED',
  'REJECTED',
]);

export const organisationRoleSchema = z.enum([
  'OWNER',
  'ADMIN',
  'RECRUITER',
  'HIRING_MANAGER',
  'INTERVIEWER',
  'VIEWER',
]);

export const membershipStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export const organisationStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export const organisationInvitationStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED']);

export const employmentTypeSchema = z.enum([
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'INTERN',
]);

export const workplaceTypeSchema = z.enum([
  'ONSITE',
  'REMOTE',
  'HYBRID',
]);

export const candidateTagSchema = z.enum(['SHORTLISTED', 'REJECTED', 'HOLD']);
export const jobVisibilitySchema = z.enum(['EXTERNAL', 'INTERNAL', 'BOTH']);
export const recruiterSavedSearchTypeSchema = z.enum(['SAVED', 'RECENT']);

export const requisitionPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const requisitionStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'OPEN',
  'ON_HOLD',
  'CLOSED',
  'CANCELLED',
]);
export const approvalStatusSchema = z.enum(['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED']);

export const interviewTypeSchema = z.enum([
  'SCREENING',
  'TECHNICAL',
  'MANAGERIAL',
  'MANAGER',
  'DIRECTOR',
  'CLIENT',
  'BEHAVIORAL',
  'HR',
  'PANEL',
  'TAKE_HOME',
  'CUSTOM',
  'OTHER',
]);

export const interviewStatusSchema = z.enum([
  'PLANNED',
  'SCHEDULED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'RESCHEDULE_REQUIRED',
]);

export const meetingModeSchema = z.enum([
  'VIRTUAL',
  'ONSITE',
  'HYBRID',
  'PHONE',
  'OTHER',
]);

export const feedbackRecommendationSchema = z.enum([
  'STRONG_HIRE',
  'HIRE',
  'HOLD',
  'NO_HIRE',
  'STRONG_NO_HIRE',
]);

export const interviewDecisionSchema = z.enum([
  'MOVE_NEXT_ROUND',
  'REJECT',
  'HOLD',
  'CANCEL',
  'COMPLETE',
  'READY_FOR_OFFER',
]);

export const notificationTypeSchema = z.enum([
  'ORGANISATION',
  'MEMBERSHIP',
  'REQUISITION',
  'JOB',
  'APPLICATION',
  'INTERVIEW',
  'FEEDBACK',
  'SYSTEM',
]);

export const offerStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'CHANGES_REQUESTED',
  'APPROVED',
  'RELEASED',
  'VIEWED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'EXPIRED',
  'SUPERSEDED',
  'JOINING_CONFIRMED',
  'JOINED',
  'NO_SHOW',
  'DEFERRED',
]);

export const offerApprovalStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'CHANGES_REQUESTED',
  'REJECTED',
  'CANCELLED',
]);

export const offerComponentFrequencySchema = z.enum([
  'ANNUAL',
  'MONTHLY',
  'ONE_TIME',
  'OTHER',
]);

export const availabilityStatusSchema = z.enum([
  'IMMEDIATE',
  'TWO_WEEKS',
  'ONE_MONTH',
  'NOT_LOOKING',
]);

export const applyToJobSchema = z.object({
  jobId: z.string().min(1),
  coverLetter: z.string().trim().max(5000).optional(),
});

export const jobStatusSchema = z.enum([
  'DRAFT',
  'OPEN',
  'CLOSED',
  'ON_HOLD',
  'ARCHIVED',
]);

const jobBaseFieldsSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(20).max(20000),
  skillsRequired: z.array(z.string().trim().min(1).max(80)).min(1).max(50),
  experienceMin: z.coerce.number().int().min(0).max(60),
  experienceMax: z.coerce.number().int().min(0).max(60),
  salaryMin: z.coerce.number().int().min(0).optional().nullable(),
  salaryMax: z.coerce.number().int().min(0).optional().nullable(),
  currency: z.string().trim().min(3).max(10).optional().nullable(),
  isPublic: z.boolean().optional(),
  publicSalaryEnabled: z.boolean().optional(),
  featuredInPortal: z.boolean().optional(),
  visibility: jobVisibilitySchema.optional(),
  location: z.string().trim().min(2).max(160),
  employmentType: employmentTypeSchema.optional(),
  workplaceType: workplaceTypeSchema.optional().nullable(),
  numberOfOpenings: z.coerce.number().int().min(1).max(1000).optional(),
  department: z.string().trim().max(120).optional().nullable(),
  businessUnit: z.string().trim().max(120).optional().nullable(),
  requisitionId: z.string().min(1).optional().nullable(),
  hiringManagerId: z.string().min(1).optional().nullable(),
  recruiterId: z.string().min(1).optional().nullable(),
  applicationDeadline: z.string().datetime().optional().nullable(),
  applicationOpensAt: z.string().datetime().optional().nullable(),
  applicationClosesAt: z.string().datetime().optional().nullable(),
  maxApplications: z.coerce.number().int().min(1).max(100000).optional().nullable(),
  targetHires: z.coerce.number().int().min(1).max(100000).optional().nullable(),
  autoCloseOnTargetHire: z.boolean().optional(),
  status: jobStatusSchema.optional(),
});

export const jobBaseSchema = jobBaseFieldsSchema.refine((value) => value.experienceMin <= value.experienceMax, {
  message: 'Minimum experience must be less than or equal to maximum experience.',
  path: ['experienceMin'],
}).refine((value) => (
  value.salaryMin == null
  || value.salaryMax == null
  || value.salaryMin <= value.salaryMax
), {
  message: 'Minimum salary must be less than or equal to maximum salary.',
  path: ['salaryMin'],
}).refine((value) => (
  !value.applicationOpensAt
  || !value.applicationClosesAt
  || new Date(value.applicationOpensAt).getTime() <= new Date(value.applicationClosesAt).getTime()
), {
  message: 'Application opening date must be before the closing date.',
  path: ['applicationOpensAt'],
});

export const createJobSchema = jobBaseSchema;
export const updateJobSchema = jobBaseFieldsSchema.partial().refine((value) => (
  value.experienceMin === undefined
  || value.experienceMax === undefined
  || value.experienceMin <= value.experienceMax
), {
  message: 'Minimum experience must be less than or equal to maximum experience.',
  path: ['experienceMin'],
}).refine((value) => (
  value.salaryMin == null
  || value.salaryMax == null
  || value.salaryMin <= value.salaryMax
), {
  message: 'Minimum salary must be less than or equal to maximum salary.',
  path: ['salaryMin'],
}).refine((value) => (
  value.applicationOpensAt === undefined
  || value.applicationClosesAt === undefined
  || !value.applicationOpensAt
  || !value.applicationClosesAt
  || new Date(value.applicationOpensAt).getTime() <= new Date(value.applicationClosesAt).getTime()
), {
  message: 'Application opening date must be before the closing date.',
  path: ['applicationOpensAt'],
});

export const updateJobStatusSchema = z.object({
  status: jobStatusSchema,
});

export const atsStageUpdateSchema = z.object({
  stage: pipelineStageSchema,
});

export const atsInterviewSchema = z.object({
  roundId: z.string().min(1),
  interviewType: interviewTypeSchema,
  scheduledStartAt: z.string().datetime(),
  scheduledEndAt: z.string().datetime(),
  timezone: z.string().trim().min(2).max(80),
  meetingMode: meetingModeSchema,
  panelMembers: z.array(z.object({
    userId: z.string().min(1),
    isLead: z.boolean().optional(),
    isObserver: z.boolean().optional(),
    feedbackRequired: z.boolean().optional(),
  })).min(1).max(20),
  meetingLocation: z.string().trim().max(200).optional().nullable(),
  meetingLink: z.string().trim().url().optional().nullable().or(z.literal('')),
  officeAddress: z.string().trim().max(300).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  candidateInstructions: z.string().trim().max(2000).optional().nullable(),
  status: interviewStatusSchema.optional(),
  durationMinutes: z.coerce.number().int().min(15).max(480).optional().nullable(),
}).refine((value) => new Date(value.scheduledStartAt) < new Date(value.scheduledEndAt), {
  message: 'Interview end time must be after the start time.',
  path: ['scheduledEndAt'],
});

export const atsInterviewCancelSchema = z.object({
  roundId: z.string().min(1),
  cancelReason: z.string().trim().min(3).max(500),
});

export const atsNoteSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

export const atsNoteUpdateSchema = atsNoteSchema;

export const recruiterResumeSearchSaveSchema = z.object({
  label: z.string().trim().min(2).max(120),
  query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  type: recruiterSavedSearchTypeSchema.optional(),
});

export const recruiterTalentPoolCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
});

export const recruiterTalentPoolCandidateSchema = z.object({
  candidateIds: z.array(z.string().min(1)).min(1).max(100),
});

export const recruiterResumeWorkflowActionSchema = z.object({
  candidateIds: z.array(z.string().min(1)).min(1).max(100),
  jobId: z.string().min(1),
  requisitionId: z.string().min(1).optional().nullable(),
  action: z.enum(['ADD_TO_ATS', 'SHORTLIST']),
});

export const recruiterResumeEmailActionSchema = z.object({
  candidateIds: z.array(z.string().min(1)).min(1).max(100),
  jobId: z.string().min(1).optional().nullable(),
  subject: z.string().trim().min(3).max(160),
  body: z.string().trim().min(10).max(5000),
});

export const recruiterResumeTagActionSchema = z.object({
  candidateIds: z.array(z.string().min(1)).min(1).max(100),
  tag: candidateTagSchema,
});

const currencyCodeSchema = z.string().trim().min(3).max(10);
const moneyValueSchema = z.coerce.number().min(0).max(1000000000);
const nullableMoneyValueSchema = moneyValueSchema.nullish();

export const offerComponentInputSchema = z.object({
  type: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  amount: moneyValueSchema,
  frequency: offerComponentFrequencySchema.optional(),
  taxable: z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).max(1000).optional(),
});

export const offerApprovalInputSchema = z.object({
  approverUserId: z.string().min(1),
  sequence: z.coerce.number().int().min(1).max(50),
});

const offerDraftBaseSchema = z.object({
  applicationId: z.string().min(1),
  currency: currencyCodeSchema,
  annualCompensation: nullableMoneyValueSchema,
  fixedCompensation: nullableMoneyValueSchema,
  variableCompensation: nullableMoneyValueSchema,
  joiningBonus: nullableMoneyValueSchema,
  retentionBonus: nullableMoneyValueSchema,
  allowancesAmount: nullableMoneyValueSchema,
  otherCompensation: nullableMoneyValueSchema,
  benefitsSummary: z.string().trim().max(2000).optional().nullable(),
  compensationNotes: z.string().trim().max(2000).optional().nullable(),
  proposedJoiningDate: z.string().datetime().optional().nullable(),
  probationPeriodMonths: z.coerce.number().int().min(0).max(36).optional().nullable(),
  noticeOrBuyoutNote: z.string().trim().max(1000).optional().nullable(),
  workMode: workplaceTypeSchema.optional().nullable(),
  workLocation: z.string().trim().max(160).optional().nullable(),
  reportingManagerName: z.string().trim().max(160).optional().nullable(),
  offerExpiryDays: z.coerce.number().int().min(1).max(90).optional().nullable(),
  termsAndConditions: z.string().trim().max(20000).optional().nullable(),
  internalNotes: z.string().trim().max(5000).optional().nullable(),
  revisionReason: z.string().trim().max(1000).optional().nullable(),
  components: z.array(offerComponentInputSchema).max(50).optional(),
  approvals: z.array(offerApprovalInputSchema).max(20).optional(),
});

function validateOfferDraft(value, ctx) {
  const numericFields = [
    'annualCompensation',
    'fixedCompensation',
    'variableCompensation',
    'joiningBonus',
    'retentionBonus',
    'allowancesAmount',
    'otherCompensation',
  ];

  for (const field of numericFields) {
    if (value[field] != null && Number(value[field]) < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Compensation values cannot be negative.',
        path: [field],
      });
    }
  }

  if (
    value.annualCompensation != null
    && value.fixedCompensation != null
    && value.variableCompensation != null
    && Number(value.annualCompensation) < Number(value.fixedCompensation) + Number(value.variableCompensation)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Annual compensation must be at least the sum of fixed and variable compensation.',
      path: ['annualCompensation'],
    });
  }
}

export const offerDraftCreateSchema = offerDraftBaseSchema.superRefine(validateOfferDraft);

export const offerDraftUpdateSchema = offerDraftBaseSchema.omit({ applicationId: true }).partial().superRefine(validateOfferDraft);

export const offerRequestApprovalSchema = z.object({
  approvals: z.array(offerApprovalInputSchema).min(1).max(20),
});

export const offerApprovalActionSchema = z.object({
  comments: z.string().trim().max(2000).optional().nullable(),
});

export const offerReleaseSchema = z.object({
  expiryAt: z.string().datetime().optional().nullable(),
});

export const offerWithdrawSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
});

export const offerRevisionCreateSchema = offerDraftBaseSchema.extend({
  sourceOfferId: z.string().min(1),
  revisionReason: z.string().trim().min(3).max(1000),
}).superRefine(validateOfferDraft);

export const offerCandidateAcceptSchema = z.object({
  confirmation: z.literal(true),
  comment: z.string().trim().max(2000).optional().nullable(),
});

export const offerCandidateRejectSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
  comment: z.string().trim().max(2000).optional().nullable(),
});

export const offerCandidateRevisionRequestSchema = z.object({
  comment: z.string().trim().min(3).max(3000),
});

export const offerJoiningUpdateSchema = z.object({
  status: z.enum(['JOINING_CONFIRMED', 'JOINED', 'DEFERRED', 'NO_SHOW']),
  actualJoiningDate: z.string().datetime().optional().nullable(),
  proposedJoiningDate: z.string().datetime().optional().nullable(),
  reason: z.string().trim().max(1000).optional().nullable(),
});

export const organisationCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
  website: z.string().trim().url().optional().or(z.literal('')),
  logoUrl: z.string().trim().url().optional().or(z.literal('')),
});

export const organisationMemberCreateSchema = z.object({
  userId: z.string().min(1),
  role: organisationRoleSchema,
});

export const organisationMemberUpdateSchema = z.object({
  role: organisationRoleSchema.optional(),
  status: membershipStatusSchema.optional(),
}).refine((value) => value.role || value.status, {
  message: 'At least one field must be provided.',
});

export const recruiterOnboardingSchema = z.object({
  organisationName: z.string().trim().min(2).max(120),
  workspaceSlug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
  companyWebsite: z.string().trim().url().optional().or(z.literal('')).nullable(),
  industry: z.string().trim().min(2).max(120),
  companySize: z.string().trim().min(1).max(80),
  location: z.string().trim().min(2).max(160),
  designation: z.string().trim().min(2).max(120),
  teamInvitationEmail: z.string().email().optional().or(z.literal('')).nullable(),
  teamInvitationRole: organisationRoleSchema.optional().nullable(),
});

export const organisationInvitationCreateSchema = z.object({
  email: z.string().email(),
  role: organisationRoleSchema.refine((value) => value !== 'OWNER', {
    message: 'Invitation role is not allowed.',
  }),
});

export const organisationInvitationTokenSchema = z.object({
  token: z.string().min(32),
});

export const requisitionBaseSchema = z.object({
  requisitionCode: z.string().trim().min(2).max(50),
  title: z.string().trim().min(2).max(160),
  department: z.string().trim().max(120).optional(),
  businessUnit: z.string().trim().max(120).optional(),
  location: z.string().trim().max(160).optional(),
  employmentType: employmentTypeSchema.optional(),
  numberOfOpenings: z.coerce.number().int().min(1).max(1000).optional(),
  hiringManagerId: z.string().min(1).optional().nullable(),
  recruiterId: z.string().min(1).optional().nullable(),
  priority: requisitionPrioritySchema.optional(),
  targetHireDate: z.string().datetime().optional().nullable(),
  status: requisitionStatusSchema.optional(),
  reasonForHiring: z.string().trim().max(2000).optional(),
  replacementFor: z.string().trim().max(160).optional(),
  budgetMin: z.coerce.number().int().min(0).optional().nullable(),
  budgetMax: z.coerce.number().int().min(0).optional().nullable(),
  currency: z.string().trim().min(3).max(10).optional(),
  approvalStatus: approvalStatusSchema.optional(),
});

export const requisitionCreateSchema = requisitionBaseSchema;
export const requisitionUpdateSchema = requisitionBaseSchema.partial();

export const requisitionApprovalSchema = z.object({
  approvalStatus: z.enum(['APPROVED', 'REJECTED']),
  status: requisitionStatusSchema.optional(),
});

export const interviewPlanRoundSchema = z.object({
  roundName: z.string().trim().min(2).max(120),
  sequence: z.coerce.number().int().min(1).max(50),
  interviewType: interviewTypeSchema,
  status: interviewStatusSchema.optional(),
  durationMinutes: z.coerce.number().int().min(15).max(480).optional().nullable(),
  ownerUserId: z.string().min(1).optional().nullable(),
  timezone: z.string().trim().min(2).max(80).optional().nullable(),
  meetingMode: meetingModeSchema.optional().nullable(),
  scheduledStartAt: z.string().datetime().optional().nullable(),
  scheduledEndAt: z.string().datetime().optional().nullable(),
  meetingLocation: z.string().trim().max(200).optional().nullable(),
  meetingLink: z.string().trim().url().optional().nullable().or(z.literal('')),
  officeAddress: z.string().trim().max(300).optional().nullable(),
  candidateInstructions: z.string().trim().max(2000).optional().nullable(),
  instructions: z.string().trim().max(2000).optional().nullable(),
  internalNotes: z.string().trim().max(3000).optional().nullable(),
  scorecardCriteria: z.array(z.object({
    key: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(120),
    weight: z.coerce.number().min(0).max(100).optional(),
  })).optional(),
  panelMembers: z.array(z.object({
    userId: z.string().min(1),
    isLead: z.boolean().optional(),
    isObserver: z.boolean().optional(),
    feedbackRequired: z.boolean().optional(),
  })).max(20).optional(),
});

export const interviewPlanCreateSchema = z.object({
  applicationId: z.string().min(1),
  title: z.string().trim().min(2).max(160),
  status: interviewStatusSchema.optional(),
  rounds: z.array(interviewPlanRoundSchema).max(20).optional(),
});

export const interviewRoundCreateSchema = z.object({
  ...interviewPlanRoundSchema.shape,
});

export const interviewPlanUpsertSchema = z.object({
  applicationId: z.string().min(1),
  title: z.string().trim().min(2).max(160),
  status: interviewStatusSchema.optional(),
  rounds: z.array(interviewPlanRoundSchema).min(1).max(20),
});

export const interviewRoundUpdateSchema = z.object({
  ...interviewPlanRoundSchema.partial().shape,
});

export const interviewRoundDecisionSchema = z.object({
  decision: interviewDecisionSchema,
  reason: z.string().trim().min(2).max(1000).optional().nullable(),
});

export const interviewRoundDuplicateSchema = z.object({
  roundName: z.string().trim().min(2).max(120).optional().nullable(),
  sequence: z.coerce.number().int().min(1).max(50).optional().nullable(),
});

export const interviewFeedbackCreateSchema = z.object({
  recommendation: feedbackRecommendationSchema.optional(),
  overallScore: z.coerce.number().int().min(0).max(100).optional().nullable(),
  technicalRating: z.coerce.number().int().min(0).max(5).optional().nullable(),
  communicationRating: z.coerce.number().int().min(0).max(5).optional().nullable(),
  problemSolvingRating: z.coerce.number().int().min(0).max(5).optional().nullable(),
  cultureFitRating: z.coerce.number().int().min(0).max(5).optional().nullable(),
  strengths: z.string().trim().max(2000).optional().nullable(),
  weaknesses: z.string().trim().max(2000).optional().nullable(),
  detailedNotes: z.string().trim().max(4000).optional().nullable(),
  comments: z.string().trim().max(4000).optional(),
  criteriaScores: z.array(z.object({
    key: z.string().trim().min(1).max(80),
    score: z.coerce.number().min(0).max(100),
    comment: z.string().trim().max(1000).optional(),
  })).optional(),
  finalize: z.boolean().optional(),
});

export const notificationReadSchema = z.object({
  notificationIds: z.array(z.string().min(1)).min(1).max(100),
});
