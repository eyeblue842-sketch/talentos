import { env } from '../config/env.js';
import { sendSuccess, apiError } from '../utils/response.js';
import {
  placeScreeningCall,
  listScreeningCalls,
  getScreeningCall,
  ingestProviderEvent,
} from '../services/aiRecruiter/aiRecruiterService.js';

function requestMeta(req) {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') };
}

// The whole feature is invisible (404) while AI_SCREENING_ENABLED is off, so
// deploying this code changes nothing for existing recruiters until an operator
// turns it on.
function ensureEnabled(res) {
  if (!env.aiScreeningEnabled) {
    res.status(404).json(apiError('Not found.'));
    return false;
  }
  return true;
}

export async function postApplicationScreeningCall(req, res, next) {
  try {
    if (!ensureEnabled(res)) return;
    const organisationId = req.user.activeMembership?.organisationId || null;
    const overrides = req.body?.overrides || req.body || {};
    const data = await placeScreeningCall(req.user, req.params.applicationId, overrides, organisationId, requestMeta(req));
    sendSuccess(res, 201, data);
  } catch (error) {
    next(error);
  }
}

export async function getApplicationScreeningCalls(req, res, next) {
  try {
    if (!ensureEnabled(res)) return;
    const organisationId = req.user.activeMembership?.organisationId || null;
    const data = await listScreeningCalls(req.user, { applicationId: req.params.applicationId }, organisationId);
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function getScreeningCallsList(req, res, next) {
  try {
    if (!ensureEnabled(res)) return;
    const organisationId = req.user.activeMembership?.organisationId || null;
    const data = await listScreeningCalls(
      req.user,
      { jobId: req.query.jobId, applicationId: req.query.applicationId, limit: req.query.limit },
      organisationId,
    );
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function getScreeningCallById(req, res, next) {
  try {
    if (!ensureEnabled(res)) return;
    const organisationId = req.user.activeMembership?.organisationId || null;
    const data = await getScreeningCall(req.user, req.params.id, organisationId);
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

// --- Unauthenticated provider webhooks -------------------------------------
// Trust comes from a shared secret (?token= or x-screening-secret header) that
// only the provider dashboards and this backend know. Rejected unless the
// feature is live and the secret matches exactly.
function webhookSecretOk(req) {
  const expected = env.aiScreeningWebhookSecret;
  if (!env.aiScreeningEnabled || !expected) return false;
  const provided = req.get('x-screening-secret') || req.query?.token || '';
  // Length check first avoids an early-exit timing signal on obvious mismatches.
  return provided.length === expected.length && provided === expected;
}

function makeWebhookHandler(providerKey) {
  return async (req, res, next) => {
    try {
      if (!webhookSecretOk(req)) {
        return res.status(403).json(apiError('Forbidden.'));
      }
      const result = await ingestProviderEvent(providerKey, req.body);
      // Always 200 so the provider stops retrying, even when unmatched.
      return sendSuccess(res, 200, { received: true, matched: result.matched });
    } catch (error) {
      return next(error);
    }
  };
}

export const postVapiScreeningWebhook = makeWebhookHandler('VAPI');
export const postPlivoScreeningWebhook = makeWebhookHandler('PLIVO');
