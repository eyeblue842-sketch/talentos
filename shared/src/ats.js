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

export const employmentTypeSchema = z.enum([
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'INTERN',
]);

export const candidateTagSchema = z.enum(['SHORTLISTED', 'REJECTED', 'HOLD']);

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
  'HR',
  'PANEL',
  'TAKE_HOME',
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

export const feedbackRecommendationSchema = z.enum([
  'STRONG_HIRE',
  'HIRE',
  'HOLD',
  'NO_HIRE',
  'STRONG_NO_HIRE',
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

export const applyToJobSchema = z.object({
  jobId: z.string().min(1),
  coverLetter: z.string().trim().max(5000).optional(),
});

export const atsStageUpdateSchema = z.object({
  stage: pipelineStageSchema,
});

export const atsInterviewSchema = z.object({
  interviewScheduledAt: z.string().datetime(),
  interviewerName: z.string().trim().min(1).max(120),
});

export const atsNoteSchema = z.object({
  content: z.string().trim().min(1).max(2000),
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

export const interviewPlanCreateSchema = z.object({
  applicationId: z.string().min(1),
  title: z.string().trim().min(2).max(160),
  status: interviewStatusSchema.optional(),
});

export const interviewRoundCreateSchema = z.object({
  roundName: z.string().trim().min(2).max(120),
  sequence: z.coerce.number().int().min(1).max(20),
  interviewType: interviewTypeSchema,
  status: interviewStatusSchema.optional(),
  scheduledStartAt: z.string().datetime().optional().nullable(),
  scheduledEndAt: z.string().datetime().optional().nullable(),
  scorecardCriteria: z.array(z.object({
    key: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(120),
    weight: z.coerce.number().min(0).max(100).optional(),
  })).optional(),
  panelUserIds: z.array(z.string().min(1)).max(20).optional(),
});

export const interviewFeedbackCreateSchema = z.object({
  recommendation: feedbackRecommendationSchema.optional(),
  overallScore: z.coerce.number().int().min(0).max(100).optional().nullable(),
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
