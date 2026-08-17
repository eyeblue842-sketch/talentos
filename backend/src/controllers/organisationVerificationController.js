import {
  approveDomainVerification,
  listPendingDomainVerifications,
  reclassifyOrganisationType,
} from '../services/organisationVerificationService.js';
import { sendSuccess } from '../utils/response.js';

function requestMeta(req) {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') };
}

export async function getPendingDomainVerifications(req, res, next) {
  try {
    const result = await listPendingDomainVerifications();
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postApproveDomainVerification(req, res, next) {
  try {
    const result = await approveDomainVerification(req.user, req.params.organisationId, requestMeta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postReclassifyOrganisationType(req, res, next) {
  try {
    const result = await reclassifyOrganisationType(req.user, req.params.organisationId, req.body, requestMeta(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}
