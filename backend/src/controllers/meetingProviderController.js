import {
  beginMeetingProviderOAuth,
  disconnectMeetingProvider,
  handleMeetingProviderOAuthCallback,
  listMeetingProviderConnections,
  validateMeetingProviderConnection,
} from '../meeting/meetingConnectionService.js';
import { sendSuccess } from '../utils/response.js';

function meta(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}

export async function getMeetingProviders(req, res, next) {
  try {
    const result = await listMeetingProviderConnections(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function startMeetingProviderConnect(req, res, next) {
  try {
    const result = await beginMeetingProviderOAuth(req.user, req.params.provider, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function validateMeetingProvider(req, res, next) {
  try {
    const result = await validateMeetingProviderConnection(req.user, req.params.provider, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function disconnectMeetingProviderController(req, res, next) {
  try {
    const result = await disconnectMeetingProvider(req.user, req.params.provider, req.user.activeMembership?.organisationId, meta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function handleMeetingProviderCallbackController(req, res, next) {
  try {
    const redirectUrl = await handleMeetingProviderOAuthCallback(req.params.provider, req.query.code, req.query.state);
    res.redirect(302, redirectUrl);
  } catch (error) {
    next(error);
  }
}
