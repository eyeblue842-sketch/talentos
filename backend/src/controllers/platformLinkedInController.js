import { sendSuccess } from '../utils/response.js';
import {
  getPlatformDashboard,
  createDestination,
  updateDestination,
  beginDestinationOAuth,
  disconnectDestination,
  updatePlatformSettings,
  setJobPlatformExclusion,
  distributeJobNow,
  retryPlatformPost,
  listShareableJobs,
} from '../services/linkedin/linkedinPlatformService.js';
import { getAttributionReport } from '../services/linkedin/linkedinAttributionService.js';

function meta(req) {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') };
}

// Thin wrapper: run the service, send JSON, forward errors.
function handle(fn, status = 200) {
  return async (req, res, next) => {
    try {
      sendSuccess(res, status, await fn(req));
    } catch (error) {
      next(error);
    }
  };
}

export const linkedInDashboard = handle(() => getPlatformDashboard());
export const linkedInCreateDestination = handle((req) => createDestination(req.user, req.body || {}, meta(req)), 201);
export const linkedInUpdateDestination = handle((req) => updateDestination(req.user, req.params.id, req.body || {}, meta(req)));
export const linkedInConnectDestination = handle((req) => beginDestinationOAuth(req.user, req.params.id, meta(req)));
export const linkedInDisconnectDestination = handle((req) => disconnectDestination(req.user, req.params.id, meta(req)));
export const linkedInUpdateSettings = handle((req) => updatePlatformSettings(req.user, req.body || {}, meta(req)));
export const linkedInShareableJobs = handle((req) => listShareableJobs({ search: req.query.search }));
export const linkedInSetExclusion = handle((req) => setJobPlatformExclusion(req.user, req.params.jobId, Boolean(req.body?.excluded), meta(req)));
export const linkedInDistributeJob = handle((req) => distributeJobNow(req.user, req.params.jobId, meta(req)), 202);
export const linkedInRetryPost = handle((req) => retryPlatformPost(req.user, req.params.postId, meta(req)));
export const linkedInAttribution = handle(() => getAttributionReport());
