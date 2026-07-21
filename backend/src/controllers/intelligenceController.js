import {
  analyticsInsightRequestSchema,
  batchCandidateMatchRequestSchema,
  candidateMatchRequestSchema,
  intelligenceFeedbackSchema,
  intelligenceGovernanceQuerySchema,
  interviewIntelligenceRequestSchema,
  jobIntelligenceRequestSchema,
  naturalLanguageTalentSearchSchema,
  resumeIntelligenceRequestSchema,
} from '@careeriz/shared';
import { sendSuccess } from '../utils/response.js';
import { getAnalyticsInsight } from '../intelligence/services/analyticsInsightService.js';
import { getBatchCandidateMatchIntelligence, getCandidateMatchIntelligence } from '../intelligence/services/candidateMatchService.js';
import { getIntelligenceGovernanceDashboard } from '../intelligence/services/adminIntelligenceService.js';
import { recordIntelligenceFeedback } from '../intelligence/services/governanceService.js';
import { getInterviewIntelligence } from '../intelligence/services/interviewIntelligenceService.js';
import { getJobIntelligence } from '../intelligence/services/jobIntelligenceService.js';
import { getResumeIntelligence } from '../intelligence/services/resumeIntelligenceService.js';
import { parseTalentSearchQuery } from '../intelligence/services/talentSearchService.js';
import { getIntelligenceProviderHealth } from '../intelligence/services/providerService.js';

function requestMeta(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null,
  };
}

export async function getIntelligenceHealth(req, res, next) {
  try {
    const health = await getIntelligenceProviderHealth();
    return sendSuccess(res, 200, health);
  } catch (error) {
    return next(error);
  }
}

export async function postResumeIntelligence(req, res, next) {
  try {
    const payload = resumeIntelligenceRequestSchema.parse(req.body);
    const data = await getResumeIntelligence(req.user, payload, requestMeta(req));
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postCandidateMatch(req, res, next) {
  try {
    const payload = candidateMatchRequestSchema.parse(req.body);
    const data = await getCandidateMatchIntelligence(req.user, payload, requestMeta(req));
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postBatchCandidateMatch(req, res, next) {
  try {
    const payload = batchCandidateMatchRequestSchema.parse(req.body);
    const data = await getBatchCandidateMatchIntelligence(req.user, payload, requestMeta(req));
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postJobIntelligence(req, res, next) {
  try {
    const payload = jobIntelligenceRequestSchema.parse(req.body);
    const data = await getJobIntelligence(req.user, payload);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postInterviewIntelligence(req, res, next) {
  try {
    const payload = interviewIntelligenceRequestSchema.parse(req.body);
    const data = await getInterviewIntelligence(req.user, payload);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postTalentSearchParse(req, res, next) {
  try {
    const payload = naturalLanguageTalentSearchSchema.parse(req.body);
    const data = await parseTalentSearchQuery(req.user, payload);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postAnalyticsInsight(req, res, next) {
  try {
    const payload = analyticsInsightRequestSchema.parse(req.body);
    const data = await getAnalyticsInsight(req.user, payload);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function getIntelligenceGovernance(req, res, next) {
  try {
    const filters = intelligenceGovernanceQuerySchema.partial().parse(req.query);
    const data = await getIntelligenceGovernanceDashboard(req.user, filters);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

export async function postIntelligenceFeedback(req, res, next) {
  try {
    const payload = intelligenceFeedbackSchema.parse(req.body);
    const data = await recordIntelligenceFeedback(req.user, payload, requestMeta(req));
    return sendSuccess(res, 201, data);
  } catch (error) {
    return next(error);
  }
}
