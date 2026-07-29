import {
  getCandidateJobMatchCompatibility,
} from './candidateMatchEngineService.js';

export async function getCandidateMatchIntelligence(actorUser, payload, requestMeta = {}) {
  return getCandidateJobMatchCompatibility(actorUser, payload, requestMeta);
}

export async function getBatchCandidateMatchIntelligence(actorUser, payload, requestMeta = {}) {
  const items = [];
  for (const candidateId of payload.candidateIds) {
    try {
      const data = await getCandidateJobMatchCompatibility(actorUser, {
        candidateId,
        jobId: payload.jobId,
        forceRegenerate: payload.forceRegenerate,
      }, requestMeta);
      items.push({ candidateId, success: true, data });
    } catch (error) {
      items.push({ candidateId, success: false, error: error.message });
    }
  }

  return { items };
}
