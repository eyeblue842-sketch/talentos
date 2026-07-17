import {
  getCandidateDashboard,
  getCandidateRecommendations,
  getCandidateSelfProfile,
  getCandidateSettings,
  listCandidateNotifications,
  listSavedJobs,
  markAllCandidateNotificationsRead,
  markCandidateNotificationRead,
  removeSavedJob,
  saveJobForCandidate,
  updateCandidateSelfProfile,
  updateCandidateSettings,
} from '../services/candidateService.js';
import { sendSuccess } from '../utils/response.js';

export async function getCandidateProfile(req, res, next) {
  try {
    const result = await getCandidateSelfProfile(req.user.candidateProfile.id);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function patchCandidateProfile(req, res, next) {
  try {
    const result = await updateCandidateSelfProfile(req.user.candidateProfile.id, req.body);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getCandidatePreferenceSettings(req, res, next) {
  try {
    const result = await getCandidateSettings(req.user.candidateProfile.id);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function patchCandidateSettings(req, res, next) {
  try {
    const result = await updateCandidateSettings(req.user.candidateProfile.id, req.body);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getCandidateSavedJobs(req, res, next) {
  try {
    const result = await listSavedJobs(req.user.candidateProfile.id, req.query);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function createSavedJob(req, res, next) {
  try {
    const result = await saveJobForCandidate(req.user.candidateProfile.id, req.body.jobId);
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function deleteSavedJob(req, res, next) {
  try {
    const result = await removeSavedJob(req.user.candidateProfile.id, req.params.jobId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getCandidateNotificationList(req, res, next) {
  try {
    const result = await listCandidateNotifications(req.user.candidateProfile.id, req.user.id, req.query);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function markCandidateNotification(req, res, next) {
  try {
    const result = await markCandidateNotificationRead(req.user.id, req.body.notificationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function markCandidateNotifications(req, res, next) {
  try {
    const result = await markAllCandidateNotificationsRead(req.user.id);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getCandidateHomeDashboard(req, res, next) {
  try {
    const result = await getCandidateDashboard(req.user.candidateProfile.id, req.user.id);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getCandidateSuggestedJobs(req, res, next) {
  try {
    const result = await getCandidateRecommendations(req.user.candidateProfile.id, { excludeSaved: true });
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

