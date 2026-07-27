import { z } from 'zod';

export const intelligenceProviderSchema = z.enum([
  'DISABLED',
  'MOCK',
  'BEDROCK',
  'OPENAI',
  'ANTHROPIC',
  'GEMINI',
  'AZURE_OPENAI',
  'OLLAMA',
  'CUSTOM_OPENAI_COMPATIBLE',
]);

export const intelligenceFeatureSchema = z.enum([
  'RESUME_SUMMARY',
  'RESUME_SKILL_EXTRACTION',
  'CANDIDATE_MATCH',
  'CANDIDATE_INTELLIGENCE',
  'JOB_DESCRIPTION',
  'INTERVIEW_ASSISTANT',
  'TALENT_SEARCH',
  'ANALYTICS_INSIGHT',
]);

export const intelligenceExecutionStatusSchema = z.enum([
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'SKIPPED',
]);

export const intelligencePermissionSchema = z.enum([
  'intelligence.resume.read',
  'intelligence.resume.generate',
  'intelligence.match.read',
  'intelligence.match.generate',
  'intelligence.candidate.read',
  'intelligence.candidate.generate',
  'intelligence.job.generate',
  'intelligence.interview.generate',
  'intelligence.search.use',
  'intelligence.analytics.use',
  'intelligence.governance.read',
  'intelligence.governance.manage',
]);

export const intelligenceFeatureFlagSchema = z.enum([
  'intelligence.resume_summary',
  'intelligence.skill_extraction',
  'intelligence.candidate_matching',
  'intelligence.candidate_intelligence',
  'intelligence.job_description',
  'intelligence.interview_assistant',
  'intelligence.talent_search',
  'intelligence.analytics_insights',
]);

export const candidateIntelligenceKindSchema = z.enum([
  'PROFILE_OVERVIEW',
  'JD_MATCH',
  'INTERVIEW_GUIDE',
  'CANDIDATE_RANKING',
  'SEARCH_INDEX',
  'CAREER_ANALYSIS',
]);

export const candidateIntelligenceStatusSchema = z.enum([
  'PENDING',
  'READY',
  'STALE',
  'FAILED',
  'DISABLED',
  'REVIEW_REQUIRED',
]);

export const naturalLanguageTalentSearchSchema = z.object({
  query: z.string().trim().min(8).max(1000),
  jobId: z.string().trim().cuid().optional().or(z.literal('')),
  requisitionId: z.string().trim().cuid().optional().or(z.literal('')),
});

export const intelligenceFeedbackSchema = z.object({
  executionId: z.string().trim().cuid(),
  rating: z.number().int().min(1).max(5).optional(),
  useful: z.boolean(),
  feedback: z.string().trim().max(1000).optional().or(z.literal('')),
  overrideReason: z.string().trim().max(500).optional().or(z.literal('')),
  dismissed: z.boolean().optional(),
});

export const resumeIntelligenceRequestSchema = z.object({
  candidateId: z.string().trim().cuid(),
  resumeAssetId: z.string().trim().cuid().optional(),
  forceRegenerate: z.boolean().optional(),
});

export const candidateIntelligenceParamsSchema = z.object({
  candidateId: z.string().trim().cuid(),
});

export const candidateIntelligenceRequestSchema = z.object({
  candidateId: z.string().trim().cuid(),
  kind: candidateIntelligenceKindSchema.default('PROFILE_OVERVIEW'),
  includeStale: z.boolean().optional(),
});

export const candidateIntelligenceRegenerateSchema = z.object({
  kind: candidateIntelligenceKindSchema.default('PROFILE_OVERVIEW'),
  forceRegenerate: z.boolean().optional(),
});

export const candidateMatchRequestSchema = z.object({
  candidateId: z.string().trim().cuid(),
  jobId: z.string().trim().cuid(),
  forceRegenerate: z.boolean().optional(),
});

export const batchCandidateMatchRequestSchema = z.object({
  candidateIds: z.array(z.string().trim().cuid()).min(1).max(25),
  jobId: z.string().trim().cuid(),
  forceRegenerate: z.boolean().optional(),
});

export const jobIntelligenceRequestSchema = z.object({
  jobId: z.string().trim().cuid().optional(),
  requisitionId: z.string().trim().cuid().optional(),
  mode: z.enum([
    'DRAFT_DESCRIPTION',
    'IMPROVE_DESCRIPTION',
    'SUGGEST_SKILLS',
    'GENERATE_SCREENING_QUESTIONS',
    'INTERVIEW_FOCUS',
  ]),
  sourceDescription: z.string().trim().max(12000).optional().or(z.literal('')),
  forceRegenerate: z.boolean().optional(),
}).refine((value) => value.jobId || value.requisitionId || value.sourceDescription, {
  message: 'Provide a job, requisition, or source description.',
  path: ['jobId'],
});

export const interviewIntelligenceRequestSchema = z.object({
  applicationId: z.string().trim().cuid(),
  roundId: z.string().trim().cuid().optional(),
  mode: z.enum([
    'QUESTION_SET',
    'RUBRIC',
    'BRIEFING',
    'NOTES_SUMMARY',
  ]),
  notes: z.string().trim().max(12000).optional().or(z.literal('')),
  forceRegenerate: z.boolean().optional(),
});

export const analyticsInsightRequestSchema = z.object({
  periodDays: z.number().int().min(7).max(365).default(30),
  recruiterId: z.string().trim().cuid().optional().or(z.literal('')),
  department: z.string().trim().max(120).optional().or(z.literal('')),
  businessUnit: z.string().trim().max(120).optional().or(z.literal('')),
  location: z.string().trim().max(120).optional().or(z.literal('')),
  forceRegenerate: z.boolean().optional(),
});

export const intelligenceGovernanceQuerySchema = z.object({
  feature: intelligenceFeatureSchema.optional(),
  status: intelligenceExecutionStatusSchema.optional(),
  provider: intelligenceProviderSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
