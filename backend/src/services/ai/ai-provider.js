import { env } from '../../config/env.js';
import { getIntelligenceProvider } from '../../intelligence/services/providerService.js';
import { parseResumeWithBedrock } from './bedrock-provider.js';
import { z } from 'zod';

const aiFieldSchema = z.object({
  value: z.union([
    z.string(),
    z.number(),
    z.array(z.string()),
    z.array(z.record(z.string(), z.any())),
    z.null(),
  ]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.string().max(120).optional(),
});

const aiCandidateSchema = z.object({
  fullName: aiFieldSchema.optional(),
  email: aiFieldSchema.optional(),
  phoneNumber: aiFieldSchema.optional(),
  linkedInUrl: aiFieldSchema.optional(),
  githubUrl: aiFieldSchema.optional(),
  portfolioUrl: aiFieldSchema.optional(),
  headline: aiFieldSchema.optional(),
  currentTitle: aiFieldSchema.optional(),
  currentEmployer: aiFieldSchema.optional(),
  currentDesignation: aiFieldSchema.optional(),
  location: aiFieldSchema.optional(),
  currentCity: aiFieldSchema.optional(),
  currentState: aiFieldSchema.optional(),
  currentCountry: aiFieldSchema.optional(),
  totalExperience: aiFieldSchema.optional(),
  summary: aiFieldSchema.optional(),
  skills: aiFieldSchema.optional(),
  functionalSkills: aiFieldSchema.optional(),
  tools: aiFieldSchema.optional(),
  frameworks: aiFieldSchema.optional(),
  cloudPlatforms: aiFieldSchema.optional(),
  databases: aiFieldSchema.optional(),
  softSkills: aiFieldSchema.optional(),
  experienceEntries: aiFieldSchema.optional(),
  educationEntries: aiFieldSchema.optional(),
  certificationEntries: aiFieldSchema.optional(),
  projectEntries: aiFieldSchema.optional(),
  languageEntries: aiFieldSchema.optional(),
  portfolioLinks: aiFieldSchema.optional(),
});

const aiResumeParseSchema = z.object({
  candidate: aiCandidateSchema,
  metadata: z.record(z.string(), z.any()).optional(),
});

const openAiCompatibleSchemaDescription = {
  candidate: {
    fullName: { value: 'string | null', confidence: 'number 0..1', source: 'string | optional' },
    email: { value: 'string | null', confidence: 'number 0..1', source: 'string | optional' },
    phoneNumber: { value: 'string | null', confidence: 'number 0..1', source: 'string | optional' },
    linkedInUrl: { value: 'string | null', confidence: 'number 0..1', source: 'string | optional' },
    githubUrl: { value: 'string | null', confidence: 'number 0..1', source: 'string | optional' },
    portfolioUrl: { value: 'string | null', confidence: 'number 0..1', source: 'string | optional' },
    headline: { value: 'string | null', confidence: 'number 0..1', source: 'string | optional' },
    currentTitle: { value: 'string | null', confidence: 'number 0..1', source: 'string | optional' },
    currentEmployer: { value: 'string | null', confidence: 'number 0..1', source: 'string | optional' },
    currentDesignation: { value: 'string | null', confidence: 'number 0..1', source: 'string | optional' },
    location: { value: 'string | null', confidence: 'number 0..1', source: 'string | optional' },
    currentCity: { value: 'string | null', confidence: 'number 0..1', source: 'string | optional' },
    currentState: { value: 'string | null', confidence: 'number 0..1', source: 'string | optional' },
    currentCountry: { value: 'string | null', confidence: 'number 0..1', source: 'string | optional' },
    totalExperience: { value: 'number | null', confidence: 'number 0..1', source: 'string | optional' },
    summary: { value: 'string | null', confidence: 'number 0..1', source: 'string | optional' },
    skills: { value: 'string[] | null', confidence: 'number 0..1', source: 'string | optional' },
    functionalSkills: { value: 'string[] | null', confidence: 'number 0..1', source: 'string | optional' },
    tools: { value: 'string[] | null', confidence: 'number 0..1', source: 'string | optional' },
    frameworks: { value: 'string[] | null', confidence: 'number 0..1', source: 'string | optional' },
    cloudPlatforms: { value: 'string[] | null', confidence: 'number 0..1', source: 'string | optional' },
    databases: { value: 'string[] | null', confidence: 'number 0..1', source: 'string | optional' },
    softSkills: { value: 'string[] | null', confidence: 'number 0..1', source: 'string | optional' },
    experienceEntries: { value: 'object[] | null', confidence: 'number 0..1', source: 'string | optional' },
    educationEntries: { value: 'object[] | null', confidence: 'number 0..1', source: 'string | optional' },
    certificationEntries: { value: 'object[] | null', confidence: 'number 0..1', source: 'string | optional' },
    projectEntries: { value: 'object[] | null', confidence: 'number 0..1', source: 'string | optional' },
    languageEntries: { value: 'object[] | null', confidence: 'number 0..1', source: 'string | optional' },
    portfolioLinks: { value: 'object[] | null', confidence: 'number 0..1', source: 'string | optional' },
  },
};

const intelligencePrompt = `Extract candidate resume data into strict JSON.
Rules:
- Return valid JSON only.
- Never invent missing values.
- Use null when a field is unavailable.
- Do not infer sensitive or protected attributes.
- Do not invent salary, employer, dates, or contact details.
- Respect resume section boundaries.
- Experience must contain jobs only.
- Education must contain academic records only.
- Certifications must contain actual credentials only.
- Projects must contain project work only.
- Languages must contain only explicitly stated language data.
- Ignore declaration text and unsupported personal details.
- Keep confidence conservative.`;

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractJsonPayload(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const direct = safeJsonParse(trimmed);
  if (direct) return direct;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return safeJsonParse(fenced[1].trim());
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return safeJsonParse(trimmed.slice(start, end + 1));
  }

  return null;
}

function normalizeField(field, fallbackArray = false) {
  if (!field) {
    return { value: fallbackArray ? [] : null, confidence: 0 };
  }

  const value = Array.isArray(field.value)
    ? field.value.every((item) => typeof item === 'string')
      ? field.value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
      : field.value.filter((item) => item && typeof item === 'object')
    : typeof field.value === 'string'
      ? field.value.trim() || null
      : typeof field.value === 'number'
        ? field.value
        : null;

  return {
    value: value ?? (fallbackArray ? [] : null),
    confidence: Number.isFinite(field.confidence) ? Math.max(0, Math.min(1, field.confidence)) : 0,
    source: field.source || undefined,
  };
}

function normalizeAiParse(parsed) {
  const result = aiResumeParseSchema.safeParse(parsed);
  if (!result.success) {
    const error = new Error('AI provider returned invalid resume JSON.');
    error.code = 'AI_INVALID_JSON';
    error.retryable = false;
    throw error;
  }

  return {
    candidate: {
      fullName: normalizeField(result.data.candidate.fullName),
      email: normalizeField(result.data.candidate.email),
      phoneNumber: normalizeField(result.data.candidate.phoneNumber),
      linkedInUrl: normalizeField(result.data.candidate.linkedInUrl),
      githubUrl: normalizeField(result.data.candidate.githubUrl),
      portfolioUrl: normalizeField(result.data.candidate.portfolioUrl),
      headline: normalizeField(result.data.candidate.headline),
      currentTitle: normalizeField(result.data.candidate.currentTitle),
      currentEmployer: normalizeField(result.data.candidate.currentEmployer),
      currentDesignation: normalizeField(result.data.candidate.currentDesignation),
      location: normalizeField(result.data.candidate.location),
      currentCity: normalizeField(result.data.candidate.currentCity),
      currentState: normalizeField(result.data.candidate.currentState),
      currentCountry: normalizeField(result.data.candidate.currentCountry),
      totalExperience: normalizeField(result.data.candidate.totalExperience),
      summary: normalizeField(result.data.candidate.summary),
      skills: normalizeField(result.data.candidate.skills, true),
      functionalSkills: normalizeField(result.data.candidate.functionalSkills, true),
      tools: normalizeField(result.data.candidate.tools, true),
      frameworks: normalizeField(result.data.candidate.frameworks, true),
      cloudPlatforms: normalizeField(result.data.candidate.cloudPlatforms, true),
      databases: normalizeField(result.data.candidate.databases, true),
      softSkills: normalizeField(result.data.candidate.softSkills, true),
      experienceEntries: normalizeField(result.data.candidate.experienceEntries, true),
      educationEntries: normalizeField(result.data.candidate.educationEntries, true),
      certificationEntries: normalizeField(result.data.candidate.certificationEntries, true),
      projectEntries: normalizeField(result.data.candidate.projectEntries, true),
      languageEntries: normalizeField(result.data.candidate.languageEntries, true),
      portfolioLinks: normalizeField(result.data.candidate.portfolioLinks, true),
    },
    metadata: result.data.metadata || {},
  };
}

export function getResumeAiProviderSelection() {
  if (env.intelligenceEnabled && env.intelligenceProvider !== 'DISABLED') {
    return {
      enabled: true,
      mode: 'intelligence',
      provider: String(env.intelligenceProvider).toLowerCase(),
      model: env.intelligenceModel || env.awsBedrockModelId || null,
    };
  }

  if (!env.aiResumeParsingEnabled || env.aiProvider === 'disabled') {
    return {
      enabled: false,
      mode: 'disabled',
      provider: 'deterministic',
      model: null,
    };
  }

  return {
    enabled: true,
    mode: 'legacy',
    provider: env.aiProvider,
    model: env.aiProvider === 'bedrock' ? env.awsBedrockModelId || null : env.aiProvider,
  };
}

async function parseResumeWithIntelligenceProvider({ text }) {
  const provider = getIntelligenceProvider();
  const response = await provider.generate({
    prompt: `${intelligencePrompt}\n\nResume:\n${text.slice(0, env.resumeImportMaxTextChars)}`,
    schema: openAiCompatibleSchemaDescription,
    settings: {
      temperature: 0,
      // The full 28-field evidence-grounded candidate schema needs headroom
      // beyond the visible JSON itself; on native gpt-5, reasoning tokens
      // also draw from this same budget (see buildReasoningPayload in
      // openaiCompatibleProvider.js, which pins reasoning_effort to
      // 'minimal' for this call so reasoning no longer crowds it out).
      maxOutputTokens: 4000,
    },
  });

  const parsed = extractJsonPayload(response?.text);
  if (!parsed) {
    const error = new Error('AI provider returned invalid resume JSON.');
    error.code = 'AI_INVALID_JSON';
    error.retryable = false;
    throw error;
  }

  return {
    ...normalizeAiParse(parsed),
    metadata: {
      ...(parsed.metadata || {}),
      provider: String(env.intelligenceProvider).toLowerCase(),
      model: response?.model || env.intelligenceModel || null,
      latencyMs: response?.latencyMs || null,
    },
  };
}

export async function parseResumeWithAi({ text, metadata = {} }) {
  const selection = getResumeAiProviderSelection();
  if (!selection.enabled) {
    return null;
  }

  if (selection.mode === 'intelligence') {
    return parseResumeWithIntelligenceProvider({ text, metadata });
  }

  if (env.aiProvider === 'mock') {
    return normalizeAiParse({
      candidate: {
        fullName: { value: metadata.fallbackName || null, confidence: metadata.fallbackName ? 0.4 : 0 },
        email: { value: null, confidence: 0 },
        phoneNumber: { value: null, confidence: 0 },
        linkedInUrl: { value: null, confidence: 0 },
        currentTitle: { value: null, confidence: 0 },
        currentEmployer: { value: null, confidence: 0 },
        location: { value: null, confidence: 0 },
        summary: { value: null, confidence: 0 },
        skills: { value: [], confidence: 0 },
      },
      metadata: {
        parser: 'careeriz-mock-ai-provider',
        provider: 'mock',
        model: 'mock',
        generatedAt: new Date().toISOString(),
      },
    });
  }

  if (env.aiProvider === 'bedrock') {
    const parsed = await parseResumeWithBedrock({ text });
    if (!parsed) return null;
    const normalized = normalizeAiParse(parsed);
    return {
      ...normalized,
      metadata: {
        ...(normalized.metadata || {}),
        provider: 'bedrock',
        model: env.awsBedrockModelId || null,
      },
    };
  }

  return null;
}
