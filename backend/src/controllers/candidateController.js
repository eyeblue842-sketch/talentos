import {
  clearCandidateJobViews,
  getCandidateInterviewCenter,
  getCandidateDashboard,
  getCandidateJobViews,
  getCandidateOfferCenter,
  getCandidateOnboardingState,
  getCandidateRecommendations,
  getCandidateSelfProfile,
  getCandidateSettings,
  listCandidateNotifications,
  listSavedJobs,
  markAllCandidateNotificationsRead,
  markCandidateNotificationRead,
  removeSavedJob,
  recordCandidateJobView,
  requestCandidateDataExport,
  requestCandidateAccountDeactivation,
  saveCandidateOnboarding,
  saveJobForCandidate,
  updateCandidateSelfProfile,
  updateCandidateSettings,
} from '../services/candidateService.js';
import {
  submitInterviewRescheduleRequest,
  withdrawInterviewRescheduleRequest,
} from '../meeting/meetingService.js';
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
    const result = await updateCandidateSelfProfile(req.user.candidateProfile.id, req.body, {
      actorUserId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
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
    const result = await updateCandidateSettings(req.user.candidateProfile.id, req.body, {
      actorUserId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
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
    const result = await saveJobForCandidate(req.user.candidateProfile.id, req.body.jobId, {
      actorUserId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function deleteSavedJob(req, res, next) {
  try {
    const result = await removeSavedJob(req.user.candidateProfile.id, req.params.jobId, {
      actorUserId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
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
    const result = await getCandidateRecommendations(req.user.candidateProfile.id, { ...req.query, excludeSaved: true });
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getCandidateOnboarding(req, res, next) {
  try {
    const result = await getCandidateOnboardingState(req.user.candidateProfile.id);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postCandidateOnboarding(req, res, next) {
  try {
    const result = await saveCandidateOnboarding(req.user.candidateProfile.id, req.body, {
      actorUserId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getCandidateInterviews(req, res, next) {
  try {
    const result = await getCandidateInterviewCenter(req.user.candidateProfile.id);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postCandidateInterviewRescheduleRequest(req, res, next) {
  try {
    const result = await submitInterviewRescheduleRequest({
      candidateUser: req.user,
      roundId: req.params.roundId,
      payload: req.body,
      requestMeta: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function withdrawCandidateInterviewReschedule(req, res, next) {
  try {
    const result = await withdrawInterviewRescheduleRequest({
      candidateUser: req.user,
      requestId: req.body.requestId,
      requestMeta: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function getCandidateOffers(req, res, next) {
  try {
    const result = await getCandidateOfferCenter(req.user.candidateProfile.id);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function exportCandidateData(req, res, next) {
  try {
    const result = await requestCandidateDataExport(req.user.candidateProfile.id, req.user.id, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function postCandidateAccountDeactivation(req, res, next) {
  try {
    const result = await requestCandidateAccountDeactivation(req.user.candidateProfile.id, req.user.id, req.body, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function createCandidateJobView(req, res, next) {
  try {
    const result = await recordCandidateJobView(req.user.candidateProfile.id, req.body.jobId, req.body);
    sendSuccess(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function getCandidateRecentJobs(req, res, next) {
  try {
    const result = await getCandidateJobViews(req.user.candidateProfile.id, req.query);
    sendSuccess(res, 200, result.items, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function deleteCandidateRecentJobs(req, res, next) {
  try {
    const result = await clearCandidateJobViews(req.user.candidateProfile.id, {
      actorUserId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}
