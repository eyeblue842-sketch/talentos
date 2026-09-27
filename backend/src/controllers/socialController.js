import { env } from '../config/env.js';
import {
  beginLinkedInOAuth,
  handleLinkedInOAuthCallback,
  getLinkedInStatus,
  disconnectLinkedIn,
  postJobToLinkedIn,
} from '../services/linkedinService.js';
import { sendSuccess } from '../utils/response.js';

export async function startLinkedInConnect(req, res, next) {
  try {
    const result = await beginLinkedInOAuth(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

// Public browser redirect target for the LinkedIn OAuth flow.
export async function linkedInOAuthCallback(req, res) {
  const base = String(env.frontendUrl).replace(/\/$/, '');
  try {
    if (req.query.error) {
      return res.redirect(`${base}/recruiter/settings?linkedin=denied`);
    }
    await handleLinkedInOAuthCallback(String(req.query.code || ''), String(req.query.state || ''));
    return res.redirect(`${base}/recruiter/settings?linkedin=connected`);
  } catch (error) {
    return res.redirect(`${base}/recruiter/settings?linkedin=error`);
  }
}

export async function getLinkedInStatusController(req, res, next) {
  try {
    const status = await getLinkedInStatus(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, status);
  } catch (error) {
    next(error);
  }
}

export async function disconnectLinkedInController(req, res, next) {
  try {
    const result = await disconnectLinkedIn(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postJobToLinkedInController(req, res, next) {
  try {
    const meta = { ipAddress: req.ip, userAgent: req.get('user-agent') };
    const result = await postJobToLinkedIn(req.user, req.params.jobId, req.body, req.user.activeMembership?.organisationId, meta);
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}
