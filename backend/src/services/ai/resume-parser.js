import { getResumeAiProviderSelection, parseResumeWithAi } from './ai-provider.js';
import {
  buildDeterministicResumeParse,
  isDateLikeValue,
  isRolePlaceholderValue,
  isSkillKeywordLike,
  sanitizeParsedCandidateField,
  sanitizeResumeData,
  sanitizeResumeString,
} from '../resumeImportUtils.js';

export const RESUME_PARSER_VERSION = '3.0.0';

// Scalar role/company fields that must never hold a tenure marker ("Present") or
// a bare date, whichever parse path (AI or deterministic) produced them.
const ROLE_SCALAR_FIELDS = ['currentTitle', 'currentDesignation', 'currentEmployer', 'headline'];
// Skill arrays that must hold short keywords, not run-on competency paragraphs.
const SKILL_ARRAY_FIELDS = ['skills', 'functionalSkills', 'tools', 'frameworks', 'cloudPlatforms', 'databases', 'softSkills'];

// Final cleanup applied to the merged candidate so the stored profile is clean
// regardless of which parser produced each field. The AI (intelligence) path and
// the deterministic path both feed through here before the result is persisted.
function finalizeMergedCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object') return candidate;
  const result = { ...candidate };

  for (const field of ROLE_SCALAR_FIELDS) {
    const entry = result[field];
    const value = typeof entry?.value === 'string' ? entry.value.trim() : entry?.value;
    if (typeof value === 'string' && (isRolePlaceholderValue(value) || isDateLikeValue(value))) {
      result[field] = { ...entry, value: null, confidence: 0 };
    }
  }

  for (const field of SKILL_ARRAY_FIELDS) {
    const entry = result[field];
    if (entry && Array.isArray(entry.value)) {
      const cleaned = entry.value.filter((item) => typeof item === 'string' && isSkillKeywordLike(item));
      result[field] = { ...entry, value: cleaned, confidence: cleaned.length ? entry.confidence : 0 };
    }
  }

  // Clean experience entries: strip tenure markers that slipped into a
  // company/employer, and drop entries that carry no usable content at all
  // (no company, no title/designation, no dates, no summary) so the candidate's
  // Employment section is not polluted with empty blocks.
  const experience = result.experienceEntries;
  if (experience && Array.isArray(experience.value)) {
    const cleaned = experience.value
      .map((item) => {
        if (!item || typeof item !== 'object') return item;
        const clean = { ...item };
        for (const key of ['company', 'employer']) {
          if (typeof clean[key] === 'string' && isRolePlaceholderValue(clean[key])) clean[key] = null;
        }
        return clean;
      })
      .filter((item) => {
        if (!item || typeof item !== 'object') return Boolean(item);
        const meaningful = [item.company, item.employer, item.title, item.designation, item.jobTitle, item.startDate, item.endDate, item.summary, item.description]
          .some((v) => typeof v === 'string' && v.trim().length > 0);
        return meaningful;
      });
    result.experienceEntries = { ...experience, value: cleaned, confidence: cleaned.length ? experience.confidence : 0 };
  }

  return result;
}

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

export function mergeResumeFieldValue(field, primary, fallback) {
  const safePrimaryValue = sanitizeAiFieldValue(field, primary?.value);
  const primaryConfidence = Number(primary?.confidence || 0);
  const fallbackConfidence = Number(fallback?.confidence || 0);

  if (!hasMeaningfulValue(safePrimaryValue)) {
    return fallback;
  }

  if (typeof safePrimaryValue === 'string' && primaryConfidence < Math.max(0.55, fallbackConfidence)) {
    return fallback;
  }

  // For array fields (skills, experience, education, ...) the AI (structured) output
  // is authoritative whenever it is non-empty. The deterministic fallback tends to
  // dump whole résumé lines / headings into arrays like skills, so we only use it
  // when the AI returned nothing (handled by the empty check above).

  return {
    ...primary,
    value: safePrimaryValue,
  };
}

export async function parseResumeTextDetailed(text, { originalFilename } = {}) {
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
      deterministicCandidate: deterministic.candidate,
      aiCandidate: null,
      mergedCandidate: sanitizeResumeData(finalizeMergedCandidate(deterministic.candidate)),
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
    mergedCandidate[field] = mergeResumeFieldValue(field, aiField, deterministicField);
  }

  return {
    deterministicCandidate: deterministic.candidate,
    aiCandidate: aiParsed.candidate,
    mergedCandidate: sanitizeResumeData(finalizeMergedCandidate(mergedCandidate)),
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

export async function parseResumeText(text, { originalFilename } = {}) {
  const result = await parseResumeTextDetailed(text, { originalFilename });
  return {
    candidate: result.mergedCandidate,
    metadata: result.metadata,
  };
}
