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
  'CANDIDATE_RANKING',
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
  'intelligence.match.override',
  'intelligence.ranking.read',
  'intelligence.ranking.generate',
  'intelligence.match.configuration.manage',
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
  'intelligence.candidate_ranking',
  'intelligence.match_overrides',
  'intelligence.match_scoring_profiles',
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

export const candidateJobMatchStatusSchema = z.enum([
  'PENDING',
  'READY',
  'FAILED',
  'STALE',
  'DISABLED',
  'REVIEW_REQUIRED',
]);

export const matchScoringProfileVersionStatusSchema = z.enum([
  'DRAFT',
  'ACTIVE',
  'ARCHIVED',
]);

export const recruiterMatchOverrideTypeSchema = z.enum([
  'SCORE_ADJUSTMENT',
  'RECOMMENDATION_OVERRIDE',
  'KNOCKOUT_OVERRIDE',
  'NOTES_ONLY',
]);

export const candidateRankingStatusSchema = z.enum([
  'PENDING',
  'READY',
  'STALE',
  'FAILED',
  'DISABLED',
  'PARTIAL',
]);

export const jobDescriptionGenerationKindSchema = z.enum([
  'FULL_DESCRIPTION',
]);

export const jobDescriptionGenerationStatusSchema = z.enum([
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

export const candidateJobMatchRecommendationLabelSchema = z.enum([
  'STRONG_MATCH',
  'MATCH',
  'PARTIAL_MATCH',
  'LIMITED_MATCH',
  'REVIEW_REQUIRED',
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

export const candidateJobMatchEvidenceSchema = z.object({
  id: z.string().trim().min(1).max(80),
  sourceType: z.enum(['CANDIDATE_PROFILE', 'JOB', 'CANDIDATE_INTELLIGENCE', 'JOB_DESCRIPTION']),
  sourceId: z.string().trim().min(1).max(120).nullable().optional(),
  fieldPath: z.string().trim().min(1).max(200),
  snippet: z.string().trim().min(1).max(180).nullable(),
  confidence: candidateIntelligenceConfidenceSchema.optional(),
  generationType: candidateIntelligenceGenerationTypeSchema,
  locator: z.string().trim().min(1).max(200).nullable().optional(),
});

export const candidateJobMatchStatementSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  confidence: candidateIntelligenceConfidenceSchema,
  evidence: z.array(candidateJobMatchEvidenceSchema).min(1).max(8),
  generationType: candidateIntelligenceGenerationTypeSchema,
});

export const candidateJobMatchSkillItemSchema = z.object({
  skill: z.string().trim().min(1).max(120),
  rationale: z.string().trim().min(1).max(400).nullable().optional(),
  confidence: candidateIntelligenceConfidenceSchema.optional(),
  evidence: z.array(candidateJobMatchEvidenceSchema).min(1).max(6),
  generationType: candidateIntelligenceGenerationTypeSchema,
});

export const candidateJobMatchScoreAreaSchema = z.object({
  score: z.number().int().min(0).max(100).nullable(),
  weight: z.number().min(0).max(1),
  label: candidateIntelligenceConfidenceLabelSchema,
  evidence: z.array(candidateJobMatchEvidenceSchema).min(1).max(8),
  generationType: candidateIntelligenceGenerationTypeSchema,
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

export const candidateJobMatchParamsSchema = z.object({
  candidateId: z.string().trim().cuid(),
  jobId: z.string().trim().cuid(),
});

export const candidateJobMatchRegenerateSchema = z.object({
  forceRegenerate: z.boolean().optional(),
});

export const candidateJobMatchResponseSchema = z.object({
  candidateId: z.string().trim().min(1).max(120),
  jobId: z.string().trim().min(1).max(120),
  overallScore: z.object({
    score: z.number().int().min(0).max(100),
    label: candidateIntelligenceConfidenceLabelSchema,
    evidence: z.array(candidateJobMatchEvidenceSchema).min(1).max(8),
    generationType: candidateIntelligenceGenerationTypeSchema,
  }),
  confidence: z.object({
    score: z.number().min(0).max(1),
    label: candidateIntelligenceConfidenceLabelSchema,
  }),
  recommendation: z.object({
    label: candidateJobMatchRecommendationLabelSchema,
    reason: candidateJobMatchStatementSchema,
  }),
  scoreBreakdown: z.object({
    requiredSkills: candidateJobMatchScoreAreaSchema,
    preferredSkills: candidateJobMatchScoreAreaSchema,
    experience: candidateJobMatchScoreAreaSchema,
    roleTitle: candidateJobMatchScoreAreaSchema,
    location: candidateJobMatchScoreAreaSchema,
    workMode: candidateJobMatchScoreAreaSchema,
    employmentType: candidateJobMatchScoreAreaSchema,
    noticePeriod: candidateJobMatchScoreAreaSchema,
    compensation: candidateJobMatchScoreAreaSchema,
    education: candidateJobMatchScoreAreaSchema,
  }),
  skills: z.object({
    matchedRequired: z.array(candidateJobMatchSkillItemSchema).max(80).default([]),
    matchedPreferred: z.array(candidateJobMatchSkillItemSchema).max(80).default([]),
    missingRequired: z.array(candidateJobMatchSkillItemSchema).max(80).default([]),
    missingPreferred: z.array(candidateJobMatchSkillItemSchema).max(80).default([]),
    transferable: z.array(candidateJobMatchSkillItemSchema).max(80).default([]),
  }),
  strengths: z.array(candidateJobMatchStatementSchema).max(12).default([]),
  risks: z.array(candidateJobMatchStatementSchema).max(12).default([]),
  interviewFocus: z.array(candidateJobMatchStatementSchema).max(12).default([]),
  recruiterSummary: candidateJobMatchStatementSchema,
  knockoutResults: z.array(z.object({
    ruleKey: z.string().trim().min(1).max(120),
    triggered: z.boolean(),
    reason: z.string().trim().min(1).max(1000),
    profileVersion: z.string().trim().min(1).max(120),
    evidence: z.array(candidateJobMatchEvidenceSchema).min(1).max(8),
  })).max(20).default([]),
  warnings: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
  execution: z.object({
    stateId: z.string().trim().min(1).max(120).nullable(),
    executionId: z.string().trim().min(1).max(120).nullable(),
    resultId: z.string().trim().min(1).max(120).nullable(),
    status: candidateJobMatchStatusSchema,
    cacheHit: z.boolean(),
    aiEnabled: z.boolean(),
    stale: z.boolean(),
    generatedAt: z.string().datetime().nullable(),
    provider: intelligenceProviderSchema,
    providerVersion: z.string().trim().min(1).max(120).nullable(),
    model: z.string().trim().min(1).max(200).nullable(),
    modelVersion: z.string().trim().min(1).max(200).nullable(),
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
  effective: z.object({
    overallScore: z.number().int().min(0).max(100),
    recommendation: candidateJobMatchRecommendationLabelSchema,
    isKnockedOut: z.boolean(),
    hasOverride: z.boolean(),
  }).optional(),
  overrides: z.array(z.object({
    id: z.string().trim().min(1).max(120),
    type: recruiterMatchOverrideTypeSchema,
    scoreDelta: z.number().int().nullable().optional(),
    recommendationOverride: candidateJobMatchRecommendationLabelSchema.nullable().optional(),
    knockoutOverride: z.boolean().nullable().optional(),
    reason: z.string().trim().min(1).max(1000).nullable(),
    notes: z.string().trim().min(1).max(2000).nullable(),
    createdByUserId: z.string().trim().min(1).max(120),
    createdAt: z.string().datetime(),
  })).optional(),
});

export const candidateJobMatchStatusResponseSchema = z.object({
  candidateId: z.string().trim().min(1).max(120),
  jobId: z.string().trim().min(1).max(120),
  status: candidateJobMatchStatusSchema,
  stale: z.boolean(),
  aiEnabled: z.boolean(),
  generatedAt: z.string().datetime().nullable(),
  latestExecutionId: z.string().trim().min(1).max(120).nullable(),
  latestResultId: z.string().trim().min(1).max(120).nullable(),
  sourceVersion: z.string().trim().min(1).max(80),
  promptVersion: z.string().trim().min(1).max(40),
  resultVersion: z.string().trim().min(1).max(80),
});

export const matchScoringProfileParamsSchema = z.object({
  profileId: z.string().trim().cuid(),
});

export const candidateJobMatchOverrideSchema = z.object({
  type: recruiterMatchOverrideTypeSchema,
  scoreDelta: z.number().int().min(-100).max(100).optional(),
  recommendationOverride: candidateJobMatchRecommendationLabelSchema.optional(),
  knockoutOverride: z.boolean().optional(),
  reason: z.string().trim().min(3).max(1000).optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
}).superRefine((value, ctx) => {
  if (['SCORE_ADJUSTMENT', 'RECOMMENDATION_OVERRIDE', 'KNOCKOUT_OVERRIDE'].includes(value.type) && !String(value.reason || '').trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reason'],
      message: 'Reason is required for material overrides.',
    });
  }
});

export const matchScoringDimensionSchema = z.object({
  enabled: z.boolean().default(true),
  weight: z.number().min(0).max(1),
});

export const matchScoringProfileWeightsSchema = z.object({
  requiredSkills: matchScoringDimensionSchema,
  preferredSkills: matchScoringDimensionSchema,
  experience: matchScoringDimensionSchema,
  roleTitle: matchScoringDimensionSchema,
  location: matchScoringDimensionSchema,
  workMode: matchScoringDimensionSchema,
  employmentType: matchScoringDimensionSchema,
  noticePeriod: matchScoringDimensionSchema,
  compensation: matchScoringDimensionSchema,
  education: matchScoringDimensionSchema,
  domain: matchScoringDimensionSchema.optional(),
});

export const matchScoringProfileCreateSchema = z.object({
  key: z.string().trim().min(2).max(120).regex(/^[a-z0-9._-]+$/i),
  name: z.string().trim().min(2).max(240),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
  title: z.string().trim().min(1).max(240).optional().or(z.literal('')),
  weightsJson: matchScoringProfileWeightsSchema,
  knockoutRulesJson: z.record(z.any()).default({}),
  thresholdsJson: z.record(z.any()).default({}),
  confidenceRulesJson: z.record(z.any()).default({}),
});

export const matchScoringProfileVersionCreateSchema = z.object({
  title: z.string().trim().min(1).max(240).optional().or(z.literal('')),
  weightsJson: matchScoringProfileWeightsSchema,
  knockoutRulesJson: z.record(z.any()).default({}),
  thresholdsJson: z.record(z.any()).default({}),
  confidenceRulesJson: z.record(z.any()).default({}),
  activate: z.boolean().optional(),
});

export const matchScoringProfileActivateSchema = z.object({
  versionId: z.string().trim().cuid().optional().or(z.literal('')),
  active: z.boolean().optional(),
});

export const matchScoringProfileVersionResponseSchema = z.object({
  id: z.string().trim().min(1).max(120),
  organisationId: z.string().trim().min(1).max(120),
  profileId: z.string().trim().min(1).max(120),
  version: z.number().int().min(1),
  status: matchScoringProfileVersionStatusSchema,
  title: z.string().trim().min(1).max(240).nullable(),
  weightsJson: z.record(z.any()),
  knockoutRulesJson: z.record(z.any()),
  thresholdsJson: z.record(z.any()),
  confidenceRulesJson: z.record(z.any()),
  normalizationVersion: z.string().trim().min(1).max(80),
  schemaVersion: z.string().trim().min(1).max(40),
  promptKey: z.string().trim().min(1).max(120).nullable(),
  promptVersion: z.string().trim().min(1).max(40).nullable(),
  resultVersion: z.string().trim().min(1).max(80),
  createdByUserId: z.string().trim().min(1).max(120).nullable(),
  createdAt: z.string().datetime(),
});

export const matchScoringProfileResponseSchema = z.object({
  id: z.string().trim().min(1).max(120),
  organisationId: z.string().trim().min(1).max(120),
  key: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(240),
  description: z.string().trim().max(1000).nullable(),
  isActive: z.boolean(),
  activeVersionId: z.string().trim().min(1).max(120).nullable(),
  activatedAt: z.string().datetime().nullable(),
  activatedByUserId: z.string().trim().min(1).max(120).nullable(),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  versions: z.array(matchScoringProfileVersionResponseSchema).optional(),
});

export const candidateRankingParamsSchema = z.object({
  jobId: z.string().trim().cuid(),
});

export const candidateRankingGenerateSchema = z.object({
  forceRegenerate: z.boolean().optional(),
  scoringProfileId: z.string().trim().cuid().optional().or(z.literal('')),
  scoringProfileVersionId: z.string().trim().cuid().optional().or(z.literal('')),
});

export const candidateRankingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: candidateRankingStatusSchema.optional(),
  recommendation: candidateJobMatchRecommendationLabelSchema.optional(),
  knockedOut: z.coerce.boolean().optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  candidate: z.string().trim().max(200).optional().or(z.literal('')),
  sort: z.enum(['rank', 'score', 'confidence']).default('rank'),
});

export const candidateRankingEntryResponseSchema = z.object({
  id: z.string().trim().min(1).max(120),
  snapshotId: z.string().trim().min(1).max(120),
  organisationId: z.string().trim().min(1).max(120),
  jobId: z.string().trim().min(1).max(120),
  candidateId: z.string().trim().min(1).max(120),
  matchStateId: z.string().trim().min(1).max(120),
  matchResultId: z.string().trim().min(1).max(120),
  rank: z.number().int().min(1),
  generatedOverallScore: z.number().int().min(0).max(100),
  effectiveOverallScore: z.number().int().min(0).max(100),
  confidenceScore: z.number().min(0).max(1).nullable(),
  generatedRecommendation: candidateJobMatchRecommendationLabelSchema,
  effectiveRecommendation: candidateJobMatchRecommendationLabelSchema,
  fitBand: z.string().trim().min(1).max(80),
  strengthSummary: z.string().trim().min(1).max(1000).nullable(),
  gapSummary: z.string().trim().min(1).max(1000).nullable(),
  isKnockedOut: z.boolean(),
  hasOverride: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const candidateRankingSnapshotResponseSchema = z.object({
  id: z.string().trim().min(1).max(120),
  organisationId: z.string().trim().min(1).max(120),
  jobId: z.string().trim().min(1).max(120),
  status: candidateRankingStatusSchema,
  candidatePoolFingerprint: z.string().trim().min(1).max(200),
  sourceFingerprint: z.string().trim().min(1).max(200),
  sourceVersion: z.string().trim().min(1).max(80),
  schemaVersion: z.string().trim().min(1).max(40),
  scoringProfileVersionId: z.string().trim().min(1).max(120).nullable(),
  latestExecutionId: z.string().trim().min(1).max(120).nullable(),
  generatedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  staleReason: z.string().trim().min(1).max(200).nullable(),
  totalCandidates: z.number().int().min(0),
  processedCandidates: z.number().int().min(0),
  failedCandidates: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const candidateRankingResponseSchema = z.object({
  snapshot: candidateRankingSnapshotResponseSchema.nullable(),
  entries: z.array(candidateRankingEntryResponseSchema),
  meta: z.object({
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    pageCount: z.number().int().min(1),
  }),
});

export const jobDescriptionParamsSchema = z.object({
  jobId: z.string().trim().cuid(),
});

export const jobDescriptionRequestSchema = z.object({
  jobId: z.string().trim().cuid(),
  kind: jobDescriptionGenerationKindSchema.default('FULL_DESCRIPTION'),
  includeStale: z.boolean().optional(),
});

export const jobDescriptionRegenerateSchema = z.object({
  kind: jobDescriptionGenerationKindSchema.default('FULL_DESCRIPTION'),
  forceRegenerate: z.boolean().optional(),
});

export const jobDescriptionResultSchema = z.object({
  jobId: z.string().trim().min(1).max(120),
  kind: jobDescriptionGenerationKindSchema,
  summary: z.string().trim().min(1).max(4000),
  responsibilities: z.array(z.string().trim().min(1).max(400)).max(40).default([]),
  requiredSkills: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
  preferredSkills: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
  screeningQuestions: z.array(z.string().trim().min(1).max(400)).max(40).default([]),
  assumptions: z.array(z.string().trim().min(1).max(400)).max(30).default([]),
  exclusionaryWordingWarnings: z.array(z.string().trim().min(1).max(400)).max(20).default([]),
  missingFields: z.array(z.string().trim().min(1).max(400)).max(30).default([]),
  interviewFocus: z.array(z.string().trim().min(1).max(400)).max(30).default([]),
  execution: z.object({
    stateId: z.string().trim().min(1).max(120).nullable(),
    executionId: z.string().trim().min(1).max(120).nullable(),
    resultId: z.string().trim().min(1).max(120).nullable(),
    status: jobDescriptionGenerationStatusSchema,
    cacheHit: z.boolean(),
    stale: z.boolean(),
    generatedAt: z.string().datetime().nullable(),
    provider: intelligenceProviderSchema,
    providerVersion: z.string().trim().min(1).max(120).nullable(),
    model: z.string().trim().min(1).max(200).nullable(),
    modelVersion: z.string().trim().min(1).max(200).nullable(),
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

export const jobDescriptionStatusResponseSchema = z.object({
  jobId: z.string().trim().min(1).max(120),
  kind: jobDescriptionGenerationKindSchema,
  status: jobDescriptionGenerationStatusSchema,
  stale: z.boolean(),
  generatedAt: z.string().datetime().nullable(),
  latestExecutionId: z.string().trim().min(1).max(120).nullable(),
  latestResultId: z.string().trim().min(1).max(120).nullable(),
  sourceVersion: z.string().trim().min(1).max(80),
  promptVersion: z.string().trim().min(1).max(40),
  resultVersion: z.string().trim().min(1).max(80),
});

export const jobDescriptionDraftStatusSchema = z.enum([
  'DRAFT',
  'APPROVED',
  'APPLIED',
  'ARCHIVED',
]);

export const jobDescriptionTemplateScopeSchema = z.enum([
  'SYSTEM',
  'ORGANISATION',
]);

export const jobDescriptionDraftContentSchema = z.object({
  title: z.string().trim().min(1).max(240).nullable().optional(),
  summary: z.string().trim().min(1).max(4000),
  responsibilities: z.array(z.string().trim().min(1).max(400)).max(40).default([]),
  requiredSkills: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
  preferredSkills: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
  screeningQuestions: z.array(z.string().trim().min(1).max(400)).max(40).default([]),
  assumptions: z.array(z.string().trim().min(1).max(400)).max(30).default([]),
  exclusionaryWordingWarnings: z.array(z.string().trim().min(1).max(400)).max(20).default([]),
  missingFields: z.array(z.string().trim().min(1).max(400)).max(30).default([]),
  interviewFocus: z.array(z.string().trim().min(1).max(400)).max(30).default([]),
});

export const jobDescriptionDraftSnapshotSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(4000),
  responsibilities: z.array(z.string().trim().min(1).max(400)).max(40).default([]),
  requirements: z.array(z.string().trim().min(1).max(400)).max(60).default([]),
  skillsRequired: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
});

export const jobDescriptionDraftCreateSchema = z.object({
  jobId: z.string().trim().cuid(),
  title: z.string().trim().min(1).max(240).optional().or(z.literal('')),
  content: jobDescriptionDraftContentSchema,
  sourceStateId: z.string().trim().cuid().optional().or(z.literal('')),
  sourceExecutionId: z.string().trim().cuid().optional().or(z.literal('')),
  sourceResultId: z.string().trim().cuid().optional().or(z.literal('')),
  templateId: z.string().trim().cuid().optional().or(z.literal('')),
  templateVersionId: z.string().trim().cuid().optional().or(z.literal('')),
  approve: z.boolean().optional(),
});

export const jobDescriptionDraftUpdateSchema = z.object({
  title: z.string().trim().min(1).max(240).optional().or(z.literal('')),
  content: jobDescriptionDraftContentSchema.partial().optional(),
  approve: z.boolean().optional(),
  archive: z.boolean().optional(),
});

export const jobDescriptionDraftApplySchema = z.object({
  applyTitle: z.boolean().optional(),
  publishStatus: z.enum(['DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED']).optional(),
});

export const jobDescriptionDraftParamsSchema = z.object({
  draftId: z.string().trim().cuid(),
});

export const jobDescriptionTemplateParamsSchema = z.object({
  templateId: z.string().trim().cuid(),
});

export const jobDescriptionTemplateCreateSchema = z.object({
  key: z.string().trim().min(2).max(120).regex(/^[a-z0-9._-]+$/i),
  name: z.string().trim().min(2).max(240),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
  title: z.string().trim().min(1).max(240).optional().or(z.literal('')),
  content: jobDescriptionDraftContentSchema,
});

export const jobDescriptionTemplateVersionCreateSchema = z.object({
  title: z.string().trim().min(1).max(240).optional().or(z.literal('')),
  content: jobDescriptionDraftContentSchema,
  promptKey: z.string().trim().min(1).max(120).optional().or(z.literal('')),
  promptVersion: z.string().trim().min(1).max(40).optional().or(z.literal('')),
  sourceResultId: z.string().trim().cuid().optional().or(z.literal('')),
  activate: z.boolean().optional(),
});

export const jobDescriptionTemplateActivateSchema = z.object({
  versionId: z.string().trim().cuid().optional().or(z.literal('')),
  active: z.boolean().optional(),
});

export const jobDescriptionDraftResponseSchema = z.object({
  id: z.string().trim().min(1).max(120),
  organisationId: z.string().trim().min(1).max(120),
  jobId: z.string().trim().min(1).max(120),
  versionGroupId: z.string().trim().min(1).max(120),
  version: z.number().int().min(1),
  previousVersionId: z.string().trim().min(1).max(120).nullable(),
  status: jobDescriptionDraftStatusSchema,
  isLatestVersion: z.boolean(),
  title: z.string().trim().min(1).max(240).nullable(),
  content: jobDescriptionDraftContentSchema,
  jobSnapshot: jobDescriptionDraftSnapshotSchema.nullable(),
  sourceStateId: z.string().trim().min(1).max(120).nullable(),
  sourceExecutionId: z.string().trim().min(1).max(120).nullable(),
  sourceResultId: z.string().trim().min(1).max(120).nullable(),
  templateId: z.string().trim().min(1).max(120).nullable(),
  templateVersionId: z.string().trim().min(1).max(120).nullable(),
  approvedAt: z.string().datetime().nullable(),
  approvedByUserId: z.string().trim().min(1).max(120).nullable(),
  appliedAt: z.string().datetime().nullable(),
  appliedByUserId: z.string().trim().min(1).max(120).nullable(),
  createdByUserId: z.string().trim().min(1).max(120).nullable(),
  updatedByUserId: z.string().trim().min(1).max(120).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const jobDescriptionTemplateVersionResponseSchema = z.object({
  id: z.string().trim().min(1).max(120),
  templateId: z.string().trim().min(1).max(120),
  version: z.number().int().min(1),
  title: z.string().trim().min(1).max(240).nullable(),
  content: jobDescriptionDraftContentSchema,
  schemaVersion: z.string().trim().min(1).max(40),
  promptKey: z.string().trim().min(1).max(120).nullable(),
  promptVersion: z.string().trim().min(1).max(40).nullable(),
  sourceResultId: z.string().trim().min(1).max(120).nullable(),
  createdByUserId: z.string().trim().min(1).max(120).nullable(),
  createdAt: z.string().datetime(),
});

export const jobDescriptionTemplateResponseSchema = z.object({
  id: z.string().trim().min(1).max(120),
  organisationId: z.string().trim().min(1).max(120).nullable(),
  scope: jobDescriptionTemplateScopeSchema,
  key: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(240),
  description: z.string().trim().max(1000).nullable(),
  isActive: z.boolean(),
  activeVersionId: z.string().trim().min(1).max(120).nullable(),
  activatedAt: z.string().datetime().nullable(),
  activatedByUserId: z.string().trim().min(1).max(120).nullable(),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  versions: z.array(jobDescriptionTemplateVersionResponseSchema).optional(),
});

export const jobDescriptionHistoryResponseSchema = z.object({
  jobId: z.string().trim().min(1).max(120),
  state: jobDescriptionStatusResponseSchema.nullable(),
  drafts: z.array(jobDescriptionDraftResponseSchema),
  generations: z.array(z.object({
    resultId: z.string().trim().min(1).max(120),
    executionId: z.string().trim().min(1).max(120),
    status: z.string().trim().min(1).max(60),
    generatedAt: z.string().datetime(),
    promptVersion: z.string().trim().min(1).max(40),
    resultVersion: z.string().trim().min(1).max(80),
    sourceFingerprint: z.string().trim().min(1).max(200),
  })),
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
