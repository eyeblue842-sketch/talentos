import { getRecruiterDashboard, getCandidateDashboard } from '../services/dashboardService.js';

export async function recruiterDashboard(req, res, next) {
  try {
    const data = await getRecruiterDashboard(req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function candidateDashboard(req, res, next) {
  try {
    const data = await getCandidateDashboard(req.user.candidateProfile.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
