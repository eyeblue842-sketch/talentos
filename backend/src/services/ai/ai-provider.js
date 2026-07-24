import { env } from '../../config/env.js';
import { parseResumeWithBedrock } from './bedrock-provider.js';
import { z } from 'zod';

const aiFieldSchema = z.object({
  value: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.string().max(120).optional(),
});

const aiCandidateSchema = z.object({
  fullName: aiFieldSchema.optional(),
  email: aiFieldSchema.optional(),
  phoneNumber: aiFieldSchema.optional(),
  linkedInUrl: aiFieldSchema.optional(),
  currentTitle: aiFieldSchema.optional(),
  currentEmployer: aiFieldSchema.optional(),
  location: aiFieldSchema.optional(),
  summary: aiFieldSchema.optional(),
  skills: aiFieldSchema.optional(),
});

const aiResumeParseSchema = z.object({
  candidate: aiCandidateSchema,
  metadata: z.record(z.string(), z.any()).optional(),
});

function normalizeField(field, fallbackArray = false) {
  if (!field) {
    return { value: fallbackArray ? [] : null, confidence: 0 };
  }

  const value = Array.isArray(field.value)
    ? field.value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : typeof field.value === 'string'
      ? field.value.trim() || null
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
      currentTitle: normalizeField(result.data.candidate.currentTitle),
      currentEmployer: normalizeField(result.data.candidate.currentEmployer),
      location: normalizeField(result.data.candidate.location),
      summary: normalizeField(result.data.candidate.summary),
      skills: normalizeField(result.data.candidate.skills, true),
    },
    metadata: result.data.metadata || {},
  };
}

export async function parseResumeWithAi({ text, metadata = {} }) {
  if (!env.aiResumeParsingEnabled || env.aiProvider === 'disabled') {
    return null;
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
        generatedAt: new Date().toISOString(),
      },
    });
  }

  if (env.aiProvider === 'bedrock') {
    const parsed = await parseResumeWithBedrock({ text });
    return parsed ? normalizeAiParse(parsed) : null;
  }

  return null;
}
