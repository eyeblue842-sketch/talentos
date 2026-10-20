import { env } from '../config/env.js';
import {
  beginLinkedInOAuth,
  handleLinkedInOAuthCallback,
  getLinkedInStatus,
  disconnectLinkedIn,
  postJobToLinkedIn,
  getJobLinkedInStatus,
  retryRecruiterLinkedInPost,
} from '../services/linkedinService.js';
import { sendSuccess } from '../utils/response.js';

function requestMeta(req) {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') };
}

export async function startLinkedInConnect(req, res, next) {
  try {
    const result = await beginLinkedInOAuth(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

// Public browser redirect target for the LinkedIn OAuth flow (recruiter AND
// platform-owner flows share it; the single-use state token says which).
export async function linkedInOAuthCallback(req, res) {
  const base = String(env.frontendUrl).replace(/\/$/, '');
  try {
    if (req.query.error) {
      // Denied/cancelled at LinkedIn. The state token is left to expire.
      return res.redirect(`${base}/recruiter/settings?linkedin=denied`);
    }
    const result = await handleLinkedInOAuthCallback(String(req.query.code || ''), String(req.query.state || ''));
    if (result.platform) return res.redirect(`${base}/platform/linkedin?linkedin=connected`);
    return res.redirect(`${base}/recruiter/settings?linkedin=connected`);
  } catch (error) {
    // Platform flows surface their specific reason (e.g. identity mismatch); recruiter flows stay generic.
    const code = error?.code && /^[A-Z_]+$/.test(error.code) ? `&reason=${error.code}` : '';
    const target = error?.code === 'IDENTITY_MISMATCH' || error?.code === 'DUPLICATE_PROFILE' || error?.code === 'PERMISSION_DENIED'
      ? `${base}/platform/linkedin?linkedin=error${code}`
      : `${base}/recruiter/settings?linkedin=error`;
    return res.redirect(target);
  }
}

export async function getLinkedInStatusController(req, res, next) {
  try {
    sendSuccess(res, 200, await getLinkedInStatus(req.user, req.user.activeMembership?.organisationId));
  } catch (error) {
    next(error);
  }
}

export async function disconnectLinkedInController(req, res, next) {
  try {
    sendSuccess(res, 200, await disconnectLinkedIn(req.user, req.user.activeMembership?.organisationId));
  } catch (error) {
    next(error);
  }
}

export async function postJobToLinkedInController(req, res, next) {
  try {
    const result = await postJobToLinkedIn(req.user, req.params.jobId, req.body, req.user.activeMembership?.organisationId, requestMeta(req));
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function getJobLinkedInStatusController(req, res, next) {
  try {
    sendSuccess(res, 200, await getJobLinkedInStatus(req.user, req.params.jobId, req.user.activeMembership?.organisationId));
  } catch (error) {
    next(error);
  }
}

export async function retryLinkedInPostController(req, res, next) {
  try {
    sendSuccess(res, 200, await retryRecruiterLinkedInPost(req.user, req.params.postId, req.user.activeMembership?.organisationId, requestMeta(req)));
  } catch (error) {
    next(error);
  }
}
