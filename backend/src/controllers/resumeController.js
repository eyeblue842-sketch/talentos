import {
  uploadCandidateResume,
  saveCandidateProfile,
  saveCandidateForRecruiter,
  removeSavedCandidate,
  getSavedCandidates,
  getCandidateResumeDownload,
} from '../services/resumeService.js';
import {
  addCandidatesToTalentPool,
  createRecruiterSavedSearch,
  createTalentPool,
  deleteRecruiterSavedSearch,
  getAuthorizedCandidateDetail,
  getRecruiterCandidatePreview,
  listRecruiterRecentSearches,
  listRecruiterSavedSearches,
  listTalentPools,
  searchCandidates,
} from '../services/searchService.js';
import { searchResumesV2 } from '../services/resumeSearchV2/service.js';
import { findCandidateResumeReference } from '../repositories/resume/resumeRepository.js';
import { getCandidateRecommendations } from '../services/candidateService.js';
import { env } from '../config/env.js';
import { apiError, sendSuccess } from '../utils/response.js';

export async function searchResumeDatabase(req, res, next) {
  try {
    const hasMinExperience = typeof req.query.minExperience !== 'undefined';
    const minExperience = hasMinExperience ? Number(req.query.minExperience) : undefined;
    const hasMaxExperience = typeof req.query.maxExperience !== 'undefined';
    const maxExperience = hasMaxExperience ? Number(req.query.maxExperience) : undefined;

    if ((hasMinExperience && Number.isNaN(minExperience)) || (hasMaxExperience && Number.isNaN(maxExperience))) {
      return res.status(422).json(apiError('Validation failed.', {
        formErrors: [],
        fieldErrors: {
          ...(hasMinExperience && Number.isNaN(minExperience) ? { minExperience: ['minExperience must be a number.'] } : {}),
          ...(hasMaxExperience && Number.isNaN(maxExperience) ? { maxExperience: ['maxExperience must be a number.'] } : {}),
        },
      }));
    }

    const filters = {
      keyword: req.query.keyword,
      skill: req.query.skill,
      skills: req.query.skills,
      booleanQuery: req.query.booleanQuery,
      location: req.query.location,
      minExperience,
      maxExperience,
      fresher: req.query.fresher,
      availability: req.query.availability,
      tag: req.query.tag,
      currentCompany: req.query.currentCompany,
      previousCompany: req.query.previousCompany,
      designation: req.query.designation,
      industry: req.query.industry,
      education: req.query.education,
      noticePeriod: req.query.noticePeriod,
      currentSalary: req.query.currentSalary,
      expectedSalary: req.query.expectedSalary,
      workAuthorization: req.query.workAuthorization,
      resumeFreshness: req.query.resumeFreshness,
      lastActive: req.query.lastActive,
      resumeAttachment: req.query.resumeAttachment,
      sortBy: req.query.sortBy,
      page: req.query.page,
      pageSize: req.query.pageSize,
    };
    const result = await searchCandidates(filters, req.user.activeMembership?.organisationId, req.user);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function searchResumeDatabaseV2(req, res, next) {
  try {
    if (!env.resumeSearchV2Enabled) {
      return res.status(404).json(apiError('Resume search v2 is disabled.', {
        code: 'RESUME_SEARCH_V2_DISABLED',
      }));
    }

    const result = await searchResumesV2(req.user, req.body, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function getCandidateDetail(req, res, next) {
  try {
    const candidate = await getAuthorizedCandidateDetail(
      req.params.candidateId,
      req.user.activeMembership?.organisationId,
      {
        actorUserId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );
    sendSuccess(res, 200, candidate);
  } catch (error) {
    next(error);
  }
}

export async function getCandidatePreview(req, res, next) {
  try {
    const candidate = await getRecruiterCandidatePreview(
      req.user,
      req.params.candidateId,
      req.user.activeMembership?.organisationId,
      {
        actorUserId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    );
    sendSuccess(res, 200, candidate);
  } catch (error) {
    next(error);
  }
}

export async function updateCandidateProfile(req, res, next) {
  try {
    const candidate = await saveCandidateProfile(req.user.candidateProfile.id, req.body);
    sendSuccess(res, 200, candidate);
  } catch (error) {
    next(error);
  }
}

export async function uploadResume(req, res, next) {
  try {
    const candidate = await uploadCandidateResume(req.user, req.file);
    sendSuccess(res, 200, candidate);
  } catch (error) {
    next(error);
  }
}

export async function saveCandidate(req, res, next) {
  try {
    const saved = await saveCandidateForRecruiter(
      req.user,
      req.params.candidateId,
      req.user.activeMembership?.organisationId,
      req.body.tag,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 200, saved);
  } catch (error) {
    next(error);
  }
}

export async function listSavedCandidates(req, res, next) {
  try {
    const result = await getSavedCandidates(req.user, req.query, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function listSavedSearches(req, res, next) {
  try {
    const [saved, recent] = await Promise.all([
      listRecruiterSavedSearches(req.user, req.user.activeMembership?.organisationId),
      listRecruiterRecentSearches(req.user, req.user.activeMembership?.organisationId),
    ]);
    sendSuccess(res, 200, saved, { recent });
  } catch (error) {
    next(error);
  }
}

export async function createSavedSearch(req, res, next) {
  try {
    const saved = await createRecruiterSavedSearch(
      req.user,
      req.body,
      req.user.activeMembership?.organisationId,
      { actorUserId: req.user.id, ipAddress: req.ip, userAgent: req.get('user-agent') },
    );
    sendSuccess(res, 201, saved);
  } catch (error) {
    next(error);
  }
}

export async function deleteSavedSearch(req, res, next) {
  try {
    const result = await deleteRecruiterSavedSearch(
      req.user,
      req.params.searchId,
      req.user.activeMembership?.organisationId,
      { actorUserId: req.user.id, ipAddress: req.ip, userAgent: req.get('user-agent') },
    );
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getTalentPools(req, res, next) {
  try {
    const pools = await listTalentPools(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, pools);
  } catch (error) {
    next(error);
  }
}

export async function postTalentPool(req, res, next) {
  try {
    const pool = await createTalentPool(
      req.user,
      req.body,
      req.user.activeMembership?.organisationId,
      { actorUserId: req.user.id, ipAddress: req.ip, userAgent: req.get('user-agent') },
    );
    sendSuccess(res, 201, pool);
  } catch (error) {
    next(error);
  }
}

export async function postTalentPoolCandidates(req, res, next) {
  try {
    const result = await addCandidatesToTalentPool(
      req.user,
      req.params.poolId,
      req.body.candidateIds,
      req.user.activeMembership?.organisationId,
      { actorUserId: req.user.id, ipAddress: req.ip, userAgent: req.get('user-agent') },
    );
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function unsaveCandidate(req, res, next) {
  try {
    const result = await removeSavedCandidate(
      req.user,
      req.params.candidateId,
      req.user.activeMembership?.organisationId,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function downloadResumePdf(req, res, next) {
  try {
    const candidate = await findCandidateResumeReference(req.user.candidateProfile.id);

    if (!candidate?.latestResumeAssetId) {
      return res.status(404).json(apiError('Resume not found.'));
    }

    const file = await getCandidateResumeDownload(
      req.user,
      req.user.candidateProfile.id,
      null,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.contentLength));
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    file.stream.pipe(res);
  } catch (error) {
    next(error);
  }
}

export async function recommendedJobs(req, res, next) {
  try {
    const result = await getCandidateRecommendations(req.user.candidateProfile.id, { excludeSaved: true });
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function downloadCandidateResume(req, res, next) {
  try {
    const file = await getCandidateResumeDownload(
      req.user,
      req.params.candidateId,
      req.user.activeMembership?.organisationId,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.contentLength));
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    file.stream.pipe(res);
  } catch (error) {
    next(error);
  }
}
