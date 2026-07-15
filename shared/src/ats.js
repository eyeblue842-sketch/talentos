import { z } from 'zod';

export const pipelineStageSchema = z.enum([
  'APPLIED',
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'SELECTED',
  'REJECTED',
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
