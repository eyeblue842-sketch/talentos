import { getResumeAiProviderSelection, parseResumeWithAi } from './ai-provider.js';
import { buildDeterministicResumeParse, sanitizeParsedCandidateField, sanitizeResumeData, sanitizeResumeString } from '../resumeImportUtils.js';

export const RESUME_PARSER_VERSION = '3.0.0';

function hasMeaningfulValue(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function sanitizeAiFieldValue(field, value) {
  if (typeof value === 'string') {
    return sanitizeParsedCandidateField(field, value);
  }
  if (Array.isArray(value)) {
    return value.filter((item) => {
      if (typeof item === 'string') {
        return hasMeaningfulValue(sanitizeParsedCandidateField(field, item) || item);
      }
      return item && typeof item === 'object';
    });
  }
  return value;
}

function mergeValue(field, primary, fallback) {
  const safePrimaryValue = sanitizeAiFieldValue(field, primary?.value);
  const primaryConfidence = Number(primary?.confidence || 0);
  const fallbackConfidence = Number(fallback?.confidence || 0);

  if (!hasMeaningfulValue(safePrimaryValue)) {
    return fallback;
  }

  if (typeof safePrimaryValue === 'string' && primaryConfidence < Math.max(0.55, fallbackConfidence)) {
    return fallback;
  }

  if (Array.isArray(safePrimaryValue) && primaryConfidence < 0.55 && hasMeaningfulValue(fallback?.value)) {
    return fallback;
  }

  return {
    ...primary,
    value: safePrimaryValue,
  };
}

export async function parseResumeText(text, { originalFilename } = {}) {
  const sanitizedText = sanitizeResumeString(text);
  const deterministic = sanitizeResumeData(buildDeterministicResumeParse(sanitizedText, originalFilename || 'resume'));
  const aiSelection = getResumeAiProviderSelection();
  let aiParsed = null;
  let aiError = null;

  if (aiSelection.enabled) {
    try {
      aiParsed = sanitizeResumeData(await parseResumeWithAi({
        text: sanitizedText,
        metadata: { fallbackName: deterministic.candidate.fullName.value },
      }));
    } catch (error) {
      aiError = error;
    }
  }

  if (!aiParsed?.candidate) {
    return {
      candidate: deterministic.candidate,
      metadata: sanitizeResumeData({
        ...(deterministic.metadata || {}),
        parserVersion: RESUME_PARSER_VERSION,
        parser: 'careeriz-resume-parser-v3',
        stages: {
          deterministic: true,
          aiRequested: aiSelection.enabled,
          aiCompleted: false,
        },
        provider: aiSelection.provider || null,
        model: aiSelection.model || null,
        aiProvider: false,
        aiRequested: aiSelection.enabled,
        aiFallbackReason: aiError?.code || (aiSelection.enabled ? 'AI_EMPTY_RESULT' : null),
      }),
    };
  }

  const mergedCandidate = { ...deterministic.candidate };
  for (const [field, deterministicField] of Object.entries(deterministic.candidate)) {
    const aiField = aiParsed.candidate[field];
    mergedCandidate[field] = mergeValue(field, aiField, deterministicField);
  }

  return {
    candidate: sanitizeResumeData(mergedCandidate),
    metadata: sanitizeResumeData({
      ...(deterministic.metadata || {}),
      ...(aiParsed.metadata || {}),
      parserVersion: RESUME_PARSER_VERSION,
      parser: 'careeriz-resume-parser-v3',
      stages: {
        deterministic: true,
        aiRequested: true,
        aiCompleted: true,
      },
      aiProvider: true,
      aiRequested: true,
      aiFallbackReason: null,
    }),
  };
}
