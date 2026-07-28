import {
  analyticsInsightOutputSchema,
  candidateIntelligenceOutputSchema,
  candidateMatchExplanationOutputSchema,
  interviewNotesSummaryOutputSchema,
  interviewQuestionSetOutputSchema,
  interviewRubricOutputSchema,
  jobDescriptionOutputSchema,
  resumeSkillExtractionOutputSchema,
  resumeSummaryOutputSchema,
  talentSearchParseOutputSchema,
} from '../schemas/outputSchemas.js';

const promptRegistry = {
  RESUME_SUMMARY: {
    key: 'RESUME_SUMMARY',
    version: '1.0.0',
    purpose: 'Generate a concise professional summary and gap analysis from resume-derived professional information.',
    outputSchema: resumeSummaryOutputSchema,
    allowedDataClasses: ['CANDIDATE_PROFESSIONAL'],
    prohibitedData: ['CANDIDATE_CONTACT', 'HIGHLY_SENSITIVE', 'PROHIBITED_FOR_AI'],
    humanReviewRequired: true,
    status: 'ACTIVE',
    defaultProviderSettings: { temperature: 0.2 },
    buildPrompt: (input) => `Summarize this candidate professionally. Do not infer sensitive traits or personality.\n\nCandidate professional data:\n${JSON.stringify(input, null, 2)}`,
  },
  RESUME_SKILL_EXTRACTION: {
    key: 'RESUME_SKILL_EXTRACTION',
    version: '1.0.0',
    purpose: 'Normalize explicit skills and certifications from resume-derived professional information.',
    outputSchema: resumeSkillExtractionOutputSchema,
    allowedDataClasses: ['CANDIDATE_PROFESSIONAL'],
    prohibitedData: ['CANDIDATE_CONTACT', 'HIGHLY_SENSITIVE', 'PROHIBITED_FOR_AI'],
    humanReviewRequired: true,
    status: 'ACTIVE',
    defaultProviderSettings: { temperature: 0.1 },
    buildPrompt: (input) => `Extract only explicit or strongly supported professional skills and certifications. Do not infer protected attributes.\n\nInput:\n${JSON.stringify(input, null, 2)}`,
  },
  CANDIDATE_JOB_MATCH_EXPLANATION: {
    key: 'CANDIDATE_JOB_MATCH_EXPLANATION',
    version: '1.0.0',
    purpose: 'Explain a deterministic match result without changing its score.',
    outputSchema: candidateMatchExplanationOutputSchema,
    allowedDataClasses: ['PUBLIC_JOB_DATA', 'CANDIDATE_PROFESSIONAL'],
    prohibitedData: ['CANDIDATE_CONTACT', 'HIGHLY_SENSITIVE', 'PROHIBITED_FOR_AI'],
    humanReviewRequired: true,
    status: 'ACTIVE',
    defaultProviderSettings: { temperature: 0.2 },
    buildPrompt: (input) => `Explain this deterministic candidate-job match result. Treat the score as authoritative and do not change it.\n\nInput:\n${JSON.stringify(input, null, 2)}`,
  },
  JOB_DESCRIPTION_DRAFT: {
    key: 'JOB_DESCRIPTION_DRAFT',
    version: '1.0.0',
    purpose: 'Draft recruiter-reviewable job description content from structured requisition and job fields.',
    outputSchema: jobDescriptionOutputSchema,
    allowedDataClasses: ['PUBLIC_JOB_DATA', 'ORGANIZATION_INTERNAL'],
    prohibitedData: ['CANDIDATE_CONTACT', 'HIGHLY_SENSITIVE', 'PROHIBITED_FOR_AI'],
    humanReviewRequired: true,
    status: 'ACTIVE',
    defaultProviderSettings: { temperature: 0.4 },
    buildPrompt: (input) => `Draft recruiter-reviewable job content only from the provided structured data. Flag assumptions explicitly. Do not invent salary, benefits, legal requirements, or locations.\n\nInput:\n${JSON.stringify(input, null, 2)}`,
  },
  JOB_DESCRIPTION_FULL: {
    key: 'JOB_DESCRIPTION_FULL',
    version: '1.0.0',
    purpose: 'Generate a full recruiter-reviewable job description payload from structured job and requisition data.',
    outputSchema: jobDescriptionOutputSchema,
    allowedDataClasses: ['PUBLIC_JOB_DATA', 'ORGANIZATION_INTERNAL'],
    prohibitedData: ['CANDIDATE_CONTACT', 'HIGHLY_SENSITIVE', 'PROHIBITED_FOR_AI'],
    humanReviewRequired: true,
    status: 'ACTIVE',
    defaultProviderSettings: { temperature: 0.3 },
    buildPrompt: (input) => `Generate a structured recruiter-reviewable job description using only the supplied job and requisition data.

Rules:
- Return valid JSON only.
- Do not invent salary, benefits, compliance requirements, visa terms, or location details.
- Do not use HTML or Markdown.
- Use assumptions only when the source data is incomplete.
- Flag exclusionary or ambiguous wording when present.

Input:
${JSON.stringify(input, null, 2)}`,
  },
  JOB_DESCRIPTION_IMPROVEMENT: {
    key: 'JOB_DESCRIPTION_IMPROVEMENT',
    version: '1.0.0',
    purpose: 'Improve an existing job description while preserving factual constraints.',
    outputSchema: jobDescriptionOutputSchema,
    allowedDataClasses: ['PUBLIC_JOB_DATA', 'ORGANIZATION_INTERNAL'],
    prohibitedData: ['CANDIDATE_CONTACT', 'HIGHLY_SENSITIVE', 'PROHIBITED_FOR_AI'],
    humanReviewRequired: true,
    status: 'ACTIVE',
    defaultProviderSettings: { temperature: 0.3 },
    buildPrompt: (input) => `Improve this job description conservatively. Do not invent facts. Flag unclear or exclusionary wording.\n\nInput:\n${JSON.stringify(input, null, 2)}`,
  },
  INTERVIEW_QUESTION_SET: {
    key: 'INTERVIEW_QUESTION_SET',
    version: '1.0.0',
    purpose: 'Generate recruiter-reviewable interview questions.',
    outputSchema: interviewQuestionSetOutputSchema,
    allowedDataClasses: ['PUBLIC_JOB_DATA', 'CANDIDATE_PROFESSIONAL', 'ORGANIZATION_INTERNAL'],
    prohibitedData: ['CANDIDATE_CONTACT', 'HIGHLY_SENSITIVE', 'PROHIBITED_FOR_AI'],
    humanReviewRequired: true,
    status: 'ACTIVE',
    defaultProviderSettings: { temperature: 0.3 },
    buildPrompt: (input) => `Generate lawful interview questions and follow-ups only from role-relevant evidence. Exclude protected topics and personality inference.\n\nInput:\n${JSON.stringify(input, null, 2)}`,
  },
  INTERVIEW_EVALUATION_RUBRIC: {
    key: 'INTERVIEW_EVALUATION_RUBRIC',
    version: '1.0.0',
    purpose: 'Generate a structured interviewer rubric.',
    outputSchema: interviewRubricOutputSchema,
    allowedDataClasses: ['PUBLIC_JOB_DATA', 'ORGANIZATION_INTERNAL'],
    prohibitedData: ['CANDIDATE_CONTACT', 'HIGHLY_SENSITIVE', 'PROHIBITED_FOR_AI'],
    humanReviewRequired: true,
    status: 'ACTIVE',
    defaultProviderSettings: { temperature: 0.2 },
    buildPrompt: (input) => `Generate a structured evaluation rubric for interviewer review. Avoid culture-fit or personality scoring.\n\nInput:\n${JSON.stringify(input, null, 2)}`,
  },
  INTERVIEW_NOTES_SUMMARY: {
    key: 'INTERVIEW_NOTES_SUMMARY',
    version: '1.0.0',
    purpose: 'Summarize recruiter-only interview notes and evidence.',
    outputSchema: interviewNotesSummaryOutputSchema,
    allowedDataClasses: ['ORGANIZATION_INTERNAL', 'CANDIDATE_PROFESSIONAL'],
    prohibitedData: ['CANDIDATE_CONTACT', 'HIGHLY_SENSITIVE', 'PROHIBITED_FOR_AI'],
    humanReviewRequired: true,
    status: 'ACTIVE',
    defaultProviderSettings: { temperature: 0.1 },
    buildPrompt: (input) => `Summarize interviewer notes. Distinguish evidence, conflicts, and missing evidence. Do not infer personality or emotion.\n\nInput:\n${JSON.stringify(input, null, 2)}`,
  },
  TALENT_SEARCH_QUERY_PARSE: {
    key: 'TALENT_SEARCH_QUERY_PARSE',
    version: '1.0.0',
    purpose: 'Convert natural-language search intent into an allowlisted filter object.',
    outputSchema: talentSearchParseOutputSchema,
    allowedDataClasses: ['PUBLIC_JOB_DATA', 'ORGANIZATION_INTERNAL'],
    prohibitedData: ['CANDIDATE_CONTACT', 'HIGHLY_SENSITIVE', 'PROHIBITED_FOR_AI'],
    humanReviewRequired: true,
    status: 'ACTIVE',
    defaultProviderSettings: { temperature: 0.1 },
    buildPrompt: (input) => `Parse this recruiter talent-search query into allowlisted filters only. Never generate SQL or hidden filters. Query:\n${JSON.stringify(input, null, 2)}`,
  },
  ANALYTICS_INSIGHT: {
    key: 'ANALYTICS_INSIGHT',
    version: '1.0.0',
    purpose: 'Generate a narrative over deterministic aggregated recruitment metrics.',
    outputSchema: analyticsInsightOutputSchema,
    allowedDataClasses: ['ORGANIZATION_INTERNAL'],
    prohibitedData: ['CANDIDATE_CONTACT', 'HIGHLY_SENSITIVE', 'PROHIBITED_FOR_AI'],
    humanReviewRequired: true,
    status: 'ACTIVE',
    defaultProviderSettings: { temperature: 0.2 },
    buildPrompt: (input) => `Explain only the supplied aggregated hiring metrics. Cite them directly, avoid unsupported causality, and say when data is insufficient.\n\nInput:\n${JSON.stringify(input, null, 2)}`,
  },
  CANDIDATE_INTELLIGENCE_PROFILE: {
    key: 'CANDIDATE_INTELLIGENCE_PROFILE',
    version: '1.0.0',
    purpose: 'Generate evidence-backed candidate insights from structured professional data and safe evidence references.',
    outputSchema: candidateIntelligenceOutputSchema,
    allowedDataClasses: ['CANDIDATE_PROFESSIONAL'],
    prohibitedData: ['CANDIDATE_CONTACT', 'HIGHLY_SENSITIVE', 'PROHIBITED_FOR_AI'],
    humanReviewRequired: true,
    status: 'ACTIVE',
    defaultProviderSettings: { temperature: 0.2 },
    buildPrompt: (input) => `Create recruiter-reviewable candidate insights using only the supplied professional evidence catalog.

Rules:
- Return valid JSON only.
- Never invent missing facts.
- Never infer protected or sensitive traits.
- Every generated statement must be explicitly supported by one or more evidenceIds from the provided catalog.
- Do not include any evidenceIds that are not present in the catalog.
- Use warnings when information is incomplete or uncertain.
- Do not mention unavailable contact details.

Input:
${JSON.stringify(input, null, 2)}`,
  },
};

export function getPromptDefinition(key) {
  const prompt = promptRegistry[key];
  if (!prompt) {
    const error = new Error(`Unknown intelligence prompt: ${key}`);
    error.statusCode = 500;
    throw error;
  }
  return prompt;
}

export function listPromptDefinitions() {
  return Object.values(promptRegistry).map((item) => ({
    key: item.key,
    version: item.version,
    purpose: item.purpose,
    allowedDataClasses: item.allowedDataClasses,
    prohibitedData: item.prohibitedData,
    humanReviewRequired: item.humanReviewRequired,
    status: item.status,
    defaultProviderSettings: item.defaultProviderSettings,
  }));
}
