import { getRecruiterDashboard } from '../services/dashboardService.js';
import { getCandidateDashboard } from '../services/candidateService.js';
import { sendSuccess } from '../utils/response.js';

export async function recruiterDashboard(req, res, next) {
  try {
    const data = await getRecruiterDashboard(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function candidateDashboard(req, res, next) {
  try {
    const data = await getCandidateDashboard(req.user.candidateProfile.id, req.user.id);
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}
