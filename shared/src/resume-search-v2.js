import { z } from 'zod';

export const resumeSearchV2KeywordModeSchema = z.enum(['MUST', 'SHOULD', 'MUST_NOT']);
export const resumeSearchV2SortSchema = z.enum(['RELEVANCE', 'PROFILE_UPDATED_AT_DESC', 'RESUME_UPDATED_AT_DESC']);

const controlCharacterPattern = /[\u0000-\u001f\u007f]/;

function safeTermSchema(max = 120) {
  return z.string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !controlCharacterPattern.test(value), 'Control characters are not allowed.');
}

export const resumeSearchV2KeywordSchema = z.object({
  term: safeTermSchema(120),
  mode: resumeSearchV2KeywordModeSchema,
});

export const resumeSearchV2FiltersSchema = z.object({
  minExperienceMonths: z.coerce.number().int().min(0).max(960).optional(),
  maxExperienceMonths: z.coerce.number().int().min(0).max(960).optional(),
  currentLocation: z.array(safeTermSchema(120)).max(20).default([]),
  preferredLocation: z.array(safeTermSchema(120)).max(20).default([]),
  currentEmployer: z.array(safeTermSchema(160)).max(20).default([]),
  excludedCompanies: z.array(safeTermSchema(160)).max(20).default([]),
  industry: z.array(safeTermSchema(120)).max(20).default([]),
  currentTitle: z.array(safeTermSchema(160)).max(20).default([]),
  skills: z.array(safeTermSchema(120)).max(50).default([]),
  education: z.array(safeTermSchema(160)).max(20).default([]),
  noticePeriodDaysMax: z.coerce.number().int().min(0).max(365).optional(),
  salaryMin: z.coerce.number().int().min(0).max(100000000).optional(),
  salaryMax: z.coerce.number().int().min(0).max(100000000).optional(),
  lastUpdatedFrom: z.string().datetime().optional(),
  lastUpdatedTo: z.string().datetime().optional(),
  availability: z.array(safeTermSchema(80)).max(10).default([]),
  parsingReviewStatus: z.array(z.enum(['READY', 'REVIEW_REQUIRED'])).max(2).default([]),
  resumeSource: z.array(safeTermSchema(80)).max(10).default([]),
  searchableProfile: z.boolean().optional(),
  salaryAuthorized: z.boolean().optional(),
}).default({});

export const resumeSearchV2RequestSchema = z.object({
  keywords: z.array(resumeSearchV2KeywordSchema).max(25).default([]),
  phrases: z.array(safeTermSchema(240)).max(10).default([]),
  filters: resumeSearchV2FiltersSchema,
  sort: resumeSearchV2SortSchema.default('RELEVANCE'),
  pageSize: z.coerce.number().int().min(1).max(50).default(25),
  cursor: z.string().trim().min(1).max(4000).nullable().default(null),
  includeHighlights: z.boolean().default(true),
  includeExplain: z.boolean().default(false),
}).superRefine((value, ctx) => {
  const mustKeywordCount = value.keywords.filter((item) => item.mode === 'MUST').length;
  if (mustKeywordCount > 12) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['keywords'],
      message: 'At most 12 MUST keywords are allowed.',
    });
  }

  const fingerprintable = [
    ...value.keywords.map((item) => `${item.mode}:${item.term.toLowerCase()}`),
    ...value.phrases.map((item) => `PHRASE:${item.toLowerCase()}`),
  ];
  if (!fingerprintable.length && !Object.values(value.filters || {}).some((item) => Array.isArray(item) ? item.length > 0 : item != null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['keywords'],
      message: 'Provide at least one keyword, phrase, or filter.',
    });
  }

  if (value.filters.salaryMin != null && value.filters.salaryMax != null && value.filters.salaryMin > value.filters.salaryMax) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['filters', 'salaryMin'],
      message: 'salaryMin cannot exceed salaryMax.',
    });
  }
});

export const resumeSearchV2ExplanationSchema = z.object({
  field: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(300),
});

export const resumeSearchV2HighlightSchema = z.object({
  field: z.enum([
    'normalizedSkills',
    'currentTitle',
    'previousTitles',
    'employmentHistoryText',
    'projectsText',
    'certifications',
  ]),
  snippets: z.array(z.string().trim().min(1).max(500)).max(5),
});

export const resumeSearchV2ResultItemSchema = z.object({
  documentId: z.string().trim().min(1).max(120),
  candidateId: z.string().trim().min(1).max(120),
  normalizedName: z.string().trim().min(1).max(240).nullable(),
  currentTitle: z.string().trim().min(1).max(240).nullable(),
  currentEmployer: z.string().trim().min(1).max(240).nullable(),
  currentLocation: z.string().trim().min(1).max(200).nullable(),
  totalExperienceMonths: z.number().int().min(0).nullable(),
  reviewRequired: z.boolean(),
  parsingConfidence: z.number().min(0).max(1).nullable(),
  resumeUpdatedAt: z.string().datetime().nullable(),
  profileUpdatedAt: z.string().datetime().nullable(),
  highlights: z.array(resumeSearchV2HighlightSchema).max(10).default([]),
  explanations: z.array(resumeSearchV2ExplanationSchema).max(20).default([]),
  score: z.number().nullable(),
});

export const resumeSearchV2ResponseSchema = z.object({
  items: z.array(resumeSearchV2ResultItemSchema),
  meta: z.object({
    pageSize: z.number().int().min(1).max(50),
    nextCursor: z.string().nullable(),
    totalRelation: z.enum(['EQ', 'GTE']),
    totalValue: z.number().int().min(0),
    searchEngine: z.enum(['OPENSEARCH']),
    indexSchemaVersion: z.string().trim().min(1).max(40),
    queryFingerprint: z.string().trim().min(1).max(128),
  }),
});
