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

export const candidateIntelligenceConfidenceLabelSchema = z.enum([
  'HIGH',
  'MEDIUM',
  'LOW',
  'UNKNOWN',
]);

export const candidateIntelligenceGenerationTypeSchema = z.enum([
  'AI_GENERATED',
  'DETERMINISTIC',
]);

export const candidateIntelligenceEvidenceSchema = z.object({
  id: z.string().trim().min(1).max(80),
  sourceType: z.enum(['CANDIDATE_PROFILE', 'RESUME_ASSET', 'RESUME_IMPORT_ITEM']),
  sourceId: z.string().trim().min(1).max(120).nullable().optional(),
  fieldPath: z.string().trim().min(1).max(200),
  snippet: z.string().trim().min(1).max(180).nullable(),
  locator: z.string().trim().min(1).max(200).nullable().optional(),
});

export const candidateIntelligenceConfidenceSchema = z.object({
  score: z.number().min(0).max(1).nullable().optional(),
  label: candidateIntelligenceConfidenceLabelSchema,
});

export const candidateIntelligenceStatementSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  confidence: candidateIntelligenceConfidenceSchema,
  evidence: z.array(candidateIntelligenceEvidenceSchema).min(1).max(6),
  generationType: candidateIntelligenceGenerationTypeSchema,
});

export const candidateIntelligenceRoleRecommendationSchema = z.object({
  role: z.string().trim().min(1).max(400),
  confidence: candidateIntelligenceConfidenceSchema,
  evidence: z.array(candidateIntelligenceEvidenceSchema).min(1).max(6),
  generationType: candidateIntelligenceGenerationTypeSchema,
  rationale: z.string().trim().min(1).max(4000),
});

export const candidateIntelligenceSkillSchema = z.object({
  name: z.string().trim().min(1).max(120),
  aliases: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
});

export const candidateIntelligenceResponseSchema = z.object({
  summary: z.object({
    professionalSummary: candidateIntelligenceStatementSchema,
    roleThemes: z.array(candidateIntelligenceStatementSchema).max(6).default([]),
  }),
  snapshot: z.object({
    candidateId: z.string().trim().min(1).max(120).optional(),
    fullName: z.string().trim().min(1).max(200).nullable().optional(),
    currentTitle: z.string().trim().min(1).max(200).nullable().optional(),
    currentEmployer: z.string().trim().min(1).max(200).nullable().optional(),
    location: z.string().trim().min(1).max(200).nullable().optional(),
    totalExperience: z.number().nullable().optional(),
    resumeAvailable: z.boolean().optional(),
    latestResumeAssetId: z.string().trim().min(1).max(120).nullable().optional(),
    resumeLastUpdatedAt: z.string().datetime().nullable().optional(),
    structuredCounts: z.object({
      skills: z.number().int().min(0),
      experienceEntries: z.number().int().min(0),
      educationEntries: z.number().int().min(0),
      certificationEntries: z.number().int().min(0),
      projectEntries: z.number().int().min(0),
      languageEntries: z.number().int().min(0),
    }),
    freshness: z.object({
      candidateUpdatedAt: z.string().datetime().nullable().optional(),
      resumeUpdatedAt: z.string().datetime().nullable().optional(),
      importUpdatedAt: z.string().datetime().nullable().optional(),
    }),
  }),
  skills: z.object({
    normalized: z.array(candidateIntelligenceSkillSchema).default([]),
    keywordClusters: z.array(candidateIntelligenceStatementSchema).max(10).default([]),
  }),
  timeline: z.array(z.object({
    id: z.string().trim().min(1).max(120),
    company: z.string().trim().min(1).max(200).nullable().optional(),
    title: z.string().trim().min(1).max(200).nullable().optional(),
    startDate: z.string().trim().min(1).max(80).nullable().optional(),
    endDate: z.string().trim().min(1).max(80).nullable().optional(),
    currentlyWorking: z.boolean().optional(),
    location: z.string().trim().min(1).max(200).nullable().optional(),
  })).max(12).default([]),
  strengths: z.array(candidateIntelligenceStatementSchema).max(8).default([]),
  developmentAreas: z.array(candidateIntelligenceStatementSchema).max(8).default([]),
  recommendedRoles: z.array(candidateIntelligenceRoleRecommendationSchema).max(8).default([]),
  missingInformation: z.array(z.object({
    code: z.string().trim().min(1).max(120),
    label: z.string().trim().min(1).max(400),
    details: z.string().trim().min(1).max(1000),
  })).max(20).default([]),
  profileCompleteness: z.object({
    score: z.number().min(0).max(100),
    label: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    missingFields: z.array(z.string().trim().min(1).max(200)).max(40).default([]),
  }),
  confidence: z.object({
    overallScore: z.number().min(0).max(1),
    overallLabel: candidateIntelligenceConfidenceLabelSchema,
    deterministicCoverage: z.number().min(0).max(1),
    aiSignalCount: z.number().int().min(0),
  }),
  quality: z.object({
    score: z.number().min(0).max(100),
    label: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  }),
  warnings: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  execution: z.object({
    stateId: z.string().trim().min(1).max(120).nullable(),
    executionId: z.string().trim().min(1).max(120).nullable(),
    resultId: z.string().trim().min(1).max(120).nullable(),
    status: candidateIntelligenceStatusSchema,
    cacheHit: z.boolean(),
    aiEnabled: z.boolean(),
    stale: z.boolean(),
    generatedAt: z.string().datetime().nullable(),
    provider: intelligenceProviderSchema,
    providerVersion: z.string().trim().min(1).max(120).nullable(),
    model: z.string().trim().min(1).max(200).nullable(),
    modelVersion: z.string().trim().min(1).max(200).nullable(),
    parserVersion: z.string().trim().min(1).max(120).nullable(),
    schemaVersion: z.string().trim().min(1).max(40),
    promptKey: z.string().trim().min(1).max(120),
    promptVersion: z.string().trim().min(1).max(40),
    resultVersion: z.string().trim().min(1).max(80),
    sourceVersion: z.string().trim().min(1).max(80),
    latencyMs: z.number().int().min(0),
    inputTokens: z.number().int().min(0).nullable(),
    outputTokens: z.number().int().min(0).nullable(),
    estimatedCost: z.number().nullable(),
  }),
});

export const candidateIntelligenceStatusResponseSchema = z.object({
  candidateId: z.string().trim().min(1).max(120),
  kind: candidateIntelligenceKindSchema,
  status: candidateIntelligenceStatusSchema,
  stale: z.boolean(),
  aiEnabled: z.boolean(),
  generatedAt: z.string().datetime().nullable(),
  latestExecutionId: z.string().trim().min(1).max(120).nullable(),
  latestResultId: z.string().trim().min(1).max(120).nullable(),
  sourceVersion: z.string().trim().min(1).max(80),
  promptVersion: z.string().trim().min(1).max(40),
  resultVersion: z.string().trim().min(1).max(80),
});

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
