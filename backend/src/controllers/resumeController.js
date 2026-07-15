import {
  uploadCandidateResume,
  saveCandidateProfile,
  saveCandidateForRecruiter,
  getSavedCandidates,
  generateResumePdf,
} from '../services/resumeService.js';
import { searchCandidates } from '../services/searchService.js';
import { prisma } from '../config/db.js';
import { getCandidateRecommendedJobs } from '../services/recommendationService.js';
import { apiError, sendSuccess } from '../utils/response.js';

export async function searchResumeDatabase(req, res, next) {
  try {
    const hasMinExperience = typeof req.query.minExperience !== 'undefined';
    const minExperience = hasMinExperience ? Number(req.query.minExperience) : undefined;

    if (hasMinExperience && Number.isNaN(minExperience)) {
      return res.status(422).json(apiError('Validation failed.', {
        formErrors: [],
        fieldErrors: {
          minExperience: ['minExperience must be a number.'],
        },
      }));
    }

    const filters = {
      keyword: req.query.keyword,
      location: req.query.location,
      minExperience,
      availability: req.query.availability,
    };
    const candidates = await searchCandidates(filters);
    sendSuccess(res, 200, candidates);
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
    const saved = await saveCandidateForRecruiter(req.user.recruiterProfile.id, req.params.candidateId, req.body.tag);
    sendSuccess(res, 200, saved);
  } catch (error) {
    next(error);
  }
}

export async function listSavedCandidates(req, res, next) {
  try {
    const saved = await getSavedCandidates(req.user.recruiterProfile.id);
    sendSuccess(res, 200, saved);
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
