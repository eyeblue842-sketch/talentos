import { parseResumeWithAi } from './ai-provider.js';
import { buildDeterministicResumeParse } from '../resumeImportUtils.js';

function mergeValue(primary, fallback) {
  return primary?.value != null ? primary : fallback;
}

export async function parseResumeText(text, { originalFilename } = {}) {
  const deterministic = buildDeterministicResumeParse(text, originalFilename || 'resume');
  const aiParsed = await parseResumeWithAi({
    text,
    metadata: { fallbackName: deterministic.candidate.fullName.value },
  }).catch(() => null);

  if (!aiParsed?.candidate) {
    return deterministic;
  }

  return {
    candidate: {
      fullName: mergeValue(aiParsed.candidate.fullName, deterministic.candidate.fullName),
      email: mergeValue(aiParsed.candidate.email, deterministic.candidate.email),
      phoneNumber: mergeValue(aiParsed.candidate.phoneNumber, deterministic.candidate.phoneNumber),
      linkedInUrl: mergeValue(aiParsed.candidate.linkedInUrl, deterministic.candidate.linkedInUrl),
      currentTitle: aiParsed.candidate.currentTitle || { value: null, confidence: 0 },
      currentEmployer: aiParsed.candidate.currentEmployer || { value: null, confidence: 0 },
      location: aiParsed.candidate.location || { value: null, confidence: 0 },
      summary: aiParsed.candidate.summary || { value: null, confidence: 0 },
      skills: aiParsed.candidate.skills || { value: null, confidence: 0 },
    },
    metadata: {
      ...(deterministic.metadata || {}),
      ...(aiParsed.metadata || {}),
      aiProvider: true,
    },
  };
}
