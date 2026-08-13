import {
  getPublicJobDetail,
  getPublicOrganisationProfile,
  getPublicPortalHome,
  listPublicOrganisations,
  searchPublicJobs,
} from '../services/publicPortalService.js';
import { sendSuccess } from '../utils/response.js';

function getCandidateId(req) {
  return req.user?.role === 'CANDIDATE' ? req.user.candidateProfile?.id : null;
}

export async function getPublicPortal(req, res, next) {
  try {
    const data = await getPublicPortalHome(getCandidateId(req));
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function listPublicJobs(req, res, next) {
  try {
    const result = await searchPublicJobs(req.query, getCandidateId(req));
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function getPublicJob(req, res, next) {
  try {
    const result = await getPublicJobDetail(req.params.slug, req.user || null, getCandidateId(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getPublicOrganisation(req, res, next) {
  try {
    const result = await getPublicOrganisationProfile(req.params.slug, req.query, req.user || null, getCandidateId(req));
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getPublicOrganisationIndex(req, res, next) {
  try {
    const result = await listPublicOrganisations();
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}
