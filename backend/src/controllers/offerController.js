import {
  acceptCandidateOffer,
  acceptOfferByToken,
  actOnOfferApproval,
  createOfferDraft,
  createOfferRevision,
  getCandidateOfferDetail,
  getCandidateOfferForApplication,
  getOfferAutomationStatus,
  getOfferByToken,
  getOfferDetail,
  getOfferPdfByToken,
  getOfferPdfForCandidate,
  getOfferPdfForRecruiter,
  listOffersForApplication,
  rejectCandidateOffer,
  rejectOfferByToken,
  releaseOffer,
  requestCandidateOfferRevision,
  requestOfferApproval,
  requestOfferRevisionByToken,
  updateJoiningLifecycle,
  updateOfferDraft,
  withdrawOffer,
} from '../services/offerService.js';
import { sendSuccess } from '../utils/response.js';

function requestMeta(req) {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') };
}

function sendPdf(res, payload) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${payload.filename}"`);
  res.send(payload.buffer);
}

export async function postOfferDraft(req, res, next) {
  try {
    const data = await createOfferDraft(req.user, req.body, req.user.activeMembership?.organisationId, requestMeta(req));
    sendSuccess(res, 201, data);
  } catch (error) {
    next(error);
  }
}

export async function getOffersByApplication(req, res, next) {
  try {
    const data = await listOffersForApplication(req.user, req.params.applicationId, req.user.activeMembership?.organisationId, requestMeta(req));
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function getOffer(req, res, next) {
  try {
    const data = await getOfferDetail(req.user, req.params.offerId, req.user.activeMembership?.organisationId, requestMeta(req));
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function patchOfferDraft(req, res, next) {
  try {
    const data = await updateOfferDraft(req.user, req.params.offerId, req.body, req.user.activeMembership?.organisationId, requestMeta(req));
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function postOfferApprovalRequest(req, res, next) {
  try {
    const data = await requestOfferApproval(req.user, req.params.offerId, req.body, req.user.activeMembership?.organisationId, requestMeta(req));
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function postOfferApprovalApprove(req, res, next) {
  try {
    const data = await actOnOfferApproval(req.user, req.params.offerId, req.params.approvalId, 'APPROVED', req.body, req.user.activeMembership?.organisationId, requestMeta(req));
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function postOfferApprovalChanges(req, res, next) {
  try {
    const data = await actOnOfferApproval(req.user, req.params.offerId, req.params.approvalId, 'CHANGES_REQUESTED', req.body, req.user.activeMembership?.organisationId, requestMeta(req));
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function postOfferApprovalReject(req, res, next) {
  try {
    const data = await actOnOfferApproval(req.user, req.params.offerId, req.params.approvalId, 'REJECTED', req.body, req.user.activeMembership?.organisationId, requestMeta(req));
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function postOfferRelease(req, res, next) {
  try {
    const data = await releaseOffer(req.user, req.params.offerId, req.body, req.user.activeMembership?.organisationId, requestMeta(req));
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function postOfferRevision(req, res, next) {
  try {
    const data = await createOfferRevision(req.user, req.body, req.user.activeMembership?.organisationId, requestMeta(req));
    sendSuccess(res, 201, data);
  } catch (error) {
    next(error);
  }
}

export async function postOfferWithdraw(req, res, next) {
  try {
    const data = await withdrawOffer(req.user, req.params.offerId, req.body, req.user.activeMembership?.organisationId, requestMeta(req));
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function postOfferJoining(req, res, next) {
  try {
    const data = await updateJoiningLifecycle(req.user, req.params.offerId, req.body, req.user.activeMembership?.organisationId, requestMeta(req));
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function downloadRecruiterOfferPdf(req, res, next) {
  try {
    const pdf = await getOfferPdfForRecruiter(req.user, req.params.offerId, req.user.activeMembership?.organisationId, requestMeta(req));
    sendPdf(res, pdf);
  } catch (error) {
    next(error);
  }
}

export async function getCandidateOfferForApplicationController(req, res, next) {
  try {
    const data = await getCandidateOfferForApplication(req.user, req.params.applicationId, requestMeta(req));
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function getCandidateOfferController(req, res, next) {
  try {
    const data = await getCandidateOfferDetail(req.user, req.params.offerId, requestMeta(req));
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function postCandidateOfferAccept(req, res, next) {
  try {
    const data = await acceptCandidateOffer(req.user, req.params.offerId, req.body, requestMeta(req));
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function postCandidateOfferReject(req, res, next) {
  try {
    const data = await rejectCandidateOffer(req.user, req.params.offerId, req.body, requestMeta(req));
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function postCandidateOfferRevisionRequest(req, res, next) {
  try {
    const data = await requestCandidateOfferRevision(req.user, req.params.offerId, req.body, requestMeta(req));
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function downloadCandidateOfferPdf(req, res, next) {
  try {
    const pdf = await getOfferPdfForCandidate(req.user, req.params.offerId, requestMeta(req));
    sendPdf(res, pdf);
  } catch (error) {
    next(error);
  }
}

export async function getTokenOffer(req, res, next) {
  try {
    const data = await getOfferByToken(req.params.token, requestMeta(req));
    sendSuccess(res, 200, data, { automation: getOfferAutomationStatus() });
  } catch (error) {
    next(error);
  }
}

export async function postTokenOfferAccept(req, res, next) {
  try {
    const data = await acceptOfferByToken(req.params.token, req.body, requestMeta(req));
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function postTokenOfferReject(req, res, next) {
  try {
    const data = await rejectOfferByToken(req.params.token, req.body, requestMeta(req));
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function postTokenOfferRevisionRequest(req, res, next) {
  try {
    const data = await requestOfferRevisionByToken(req.params.token, req.body, requestMeta(req));
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function downloadTokenOfferPdf(req, res, next) {
  try {
    const pdf = await getOfferPdfByToken(req.params.token, requestMeta(req));
    sendPdf(res, pdf);
  } catch (error) {
    next(error);
  }
}
