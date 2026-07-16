import {
  uploadCandidateResume,
  saveCandidateProfile,
  saveCandidateForRecruiter,
  removeSavedCandidate,
  getSavedCandidates,
  generateResumePdf,
} from '../services/resumeService.js';
import { getAuthorizedCandidateDetail, searchCandidates } from '../services/searchService.js';
import { prisma } from '../config/db.js';
import { getCandidateRecommendedJobs } from '../services/recommendationService.js';
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
      location: req.query.location,
      minExperience,
      maxExperience,
      fresher: req.query.fresher,
      availability: req.query.availability,
      tag: req.query.tag,
      page: req.query.page,
      pageSize: req.query.pageSize,
    };
    const result = await searchCandidates(filters, req.user.activeMembership?.organisationId);
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
    const candidate = await uploadCandidateResume(req.user.candidateProfile.id, req.file);
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
    const candidate = await prisma.candidateProfile.findUnique({ where: { id: req.user.candidateProfile.id } });
    const resumeBuilder = await prisma.resumeBuilder.findUnique({ where: { candidateId: req.user.candidateProfile.id } });
    const pdf = await generateResumePdf(candidate, resumeBuilder);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${candidate.fullName}-resume.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
}

export async function recommendedJobs(req, res, next) {
  try {
    const result = await getCandidateRecommendedJobs(req.user.candidateProfile.id);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}
