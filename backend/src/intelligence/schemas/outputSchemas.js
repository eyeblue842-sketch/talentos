import { z } from 'zod';

const safeShortString = z.string().trim().min(1).max(400);
const safeLongString = z.string().trim().min(1).max(4000);
const safeStringArray = z.array(z.string().trim().min(1).max(120)).max(40);

export const resumeSummaryOutputSchema = z.object({
  professionalSummary: safeLongString,
  workHistorySummary: safeLongString,
  educationSummary: safeLongString,
  certifications: safeStringArray.default([]),
  skillClusters: safeStringArray.default([]),
  dataGaps: safeStringArray.default([]),
}).strict();

export const resumeSkillExtractionOutputSchema = z.object({
  normalizedSkills: safeStringArray.default([]),
  inferredFromContext: safeStringArray.default([]),
  certifications: safeStringArray.default([]),
  dataGaps: safeStringArray.default([]),
}).strict();

export const candidateMatchExplanationOutputSchema = z.object({
  explanation: safeLongString,
  strengths: safeStringArray.default([]),
  missingCriteria: safeStringArray.default([]),
  unknownCriteria: safeStringArray.default([]),
}).strict();

export const jobDescriptionOutputSchema = z.object({
  summary: safeLongString,
  responsibilities: safeStringArray.default([]),
  requiredSkills: safeStringArray.default([]),
  preferredSkills: safeStringArray.default([]),
  screeningQuestions: safeStringArray.default([]),
  assumptions: safeStringArray.default([]),
  exclusionaryWordingWarnings: safeStringArray.default([]),
  missingFields: safeStringArray.default([]),
  interviewFocus: safeStringArray.default([]),
}).strict();

export const interviewQuestionSetOutputSchema = z.object({
  questions: z.array(z.object({
    type: z.enum(['TECHNICAL', 'BEHAVIOURAL', 'ROLE_SPECIFIC', 'FOLLOW_UP']),
    question: safeShortString,
    rationale: safeShortString,
  }).strict()).max(20),
  warnings: safeStringArray.default([]),
}).strict();

export const interviewRubricOutputSchema = z.object({
  criteria: z.array(z.object({
    label: safeShortString,
    evidenceToLookFor: safeShortString,
    scoreGuidance: safeShortString,
  }).strict()).max(12),
  warnings: safeStringArray.default([]),
}).strict();

export const interviewNotesSummaryOutputSchema = z.object({
  summary: safeLongString,
  evidenceExtracted: safeStringArray.default([]),
  conflictingFeedback: safeStringArray.default([]),
  missingEvidence: safeStringArray.default([]),
}).strict();

export const talentSearchParseOutputSchema = z.object({
  keyword: z.string().trim().max(300).default(''),
  skills: safeStringArray.default([]),
  minExperience: z.number().int().min(0).max(60).nullable().default(null),
  maxExperience: z.number().int().min(0).max(60).nullable().default(null),
  location: z.string().trim().max(160).default(''),
  workMode: z.enum(['ONSITE', 'REMOTE', 'HYBRID']).nullable().default(null),
  availability: z.enum(['IMMEDIATE', 'TWO_WEEKS', 'ONE_MONTH', 'NOT_LOOKING']).nullable().default(null),
  noticePeriodDaysMax: z.number().int().min(0).max(365).nullable().default(null),
  currentTitle: z.string().trim().max(160).default(''),
  education: z.string().trim().max(160).default(''),
  certifications: safeStringArray.default([]),
  applicationStatus: z.enum(['APPLIED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED', 'WITHDRAWN']).nullable().default(null),
  talentPool: z.string().trim().max(160).default(''),
  recencyDays: z.number().int().min(1).max(365).nullable().default(null),
  interpretedFilters: safeStringArray.default([]),
  warnings: safeStringArray.default([]),
}).strict();

export const analyticsInsightOutputSchema = z.object({
  summary: safeLongString,
  findings: safeStringArray.default([]),
  metricReferences: safeStringArray.default([]),
  cautions: safeStringArray.default([]),
  insufficientData: z.boolean().default(false),
}).strict();
