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

export async function searchResumeDatabase(req, res, next) {
  try {
    const filters = {
      keyword: req.query.keyword,
      location: req.query.location,
      minExperience: req.query.minExperience ? Number(req.query.minExperience) : undefined,
      availability: req.query.availability,
    };
    const candidates = await searchCandidates(filters);
    res.json({ success: true, data: candidates });
  } catch (error) {
    next(error);
  }
}

export async function updateCandidateProfile(req, res, next) {
  try {
    const candidate = await saveCandidateProfile(req.user.candidateProfile.id, req.body);
    res.json({ success: true, data: candidate });
  } catch (error) {
    next(error);
  }
}

export async function uploadResume(req, res, next) {
  try {
    const candidate = await uploadCandidateResume(req.user.candidateProfile.id, req.file);
    res.json({ success: true, data: candidate });
  } catch (error) {
    next(error);
  }
}

export async function saveCandidate(req, res, next) {
  try {
    const saved = await saveCandidateForRecruiter(req.user.recruiterProfile.id, req.params.candidateId, req.body.tag);
    res.json({ success: true, data: saved });
  } catch (error) {
    next(error);
  }
}

export async function listSavedCandidates(req, res, next) {
  try {
    const saved = await getSavedCandidates(req.user.recruiterProfile.id);
    res.json({ success: true, data: saved });
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
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
