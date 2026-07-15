import { getRecruiterDashboard, getCandidateDashboard } from '../services/dashboardService.js';
import { sendSuccess } from '../utils/response.js';

export async function recruiterDashboard(req, res, next) {
  try {
    const data = await getRecruiterDashboard(req.user.id);
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}

export async function candidateDashboard(req, res, next) {
  try {
    const data = await getCandidateDashboard(req.user.candidateProfile.id);
    sendSuccess(res, 200, data);
  } catch (error) {
    next(error);
  }
}
