import {
  addInterviewRound,
  createInterviewPlan,
  decideInterviewRound,
  duplicateInterviewRound,
  listInterviewFeedback,
  listInterviewPlans,
  submitInterviewFeedback,
  updateInterviewRound,
} from '../services/interviewService.js';
import {
  checkInterviewAvailability,
  downloadCandidateInterviewCalendar,
  downloadInterviewCalendar,
  getOrganisationInterviewMeeting,
  listInterviewerAssignedMeetings,
  listOrganisationInterviewMeetings,
  reviewInterviewRescheduleRequest,
  submitInterviewRescheduleRequest,
  withdrawInterviewRescheduleRequest,
} from '../meeting/meetingService.js';
import { sendSuccess } from '../utils/response.js';

export async function createPlan(req, res, next) {
  try {
    const plan = await createInterviewPlan(req.user, req.body, req.user.activeMembership?.organisationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, 201, plan);
  } catch (error) {
    next(error);
  }
}

export async function listPlans(req, res, next) {
  try {
    const plans = await listInterviewPlans(req.user, req.params.applicationId, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, plans);
  } catch (error) {
    next(error);
  }
}

export async function createRound(req, res, next) {
  try {
    const round = await addInterviewRound(
      req.user,
      req.params.interviewProcessId,
      req.body,
      req.user.activeMembership?.organisationId,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 201, round);
  } catch (error) {
    next(error);
  }
}

export async function updateRound(req, res, next) {
  try {
    const round = await updateInterviewRound(
      req.user,
      req.params.roundId,
      req.body,
      req.user.activeMembership?.organisationId,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 200, round);
  } catch (error) {
    next(error);
  }
}

export async function duplicateRound(req, res, next) {
  try {
    const round = await duplicateInterviewRound(
      req.user,
      req.params.roundId,
      req.body,
      req.user.activeMembership?.organisationId,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 201, round);
  } catch (error) {
    next(error);
  }
}

export async function createFeedback(req, res, next) {
  try {
    const feedback = await submitInterviewFeedback(
      req.user,
      req.params.roundId,
      req.body,
      req.user.activeMembership?.organisationId,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 201, feedback);
  } catch (error) {
    next(error);
  }
}

export async function decideRound(req, res, next) {
  try {
    const round = await decideInterviewRound(
      req.user,
      req.params.roundId,
      req.body,
      req.user.activeMembership?.organisationId,
      { ipAddress: req.ip, userAgent: req.get('user-agent') }
    );
    sendSuccess(res, 200, round);
  } catch (error) {
    next(error);
  }
}

export async function getFeedback(req, res, next) {
  try {
    const feedback = await listInterviewFeedback(req.user, req.params.roundId, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, feedback);
  } catch (error) {
    next(error);
  }
}

export async function downloadRoundCalendar(req, res, next) {
  try {
    const calendar = await downloadInterviewCalendar(req.user, req.params.roundId, req.user.activeMembership?.organisationId);
    res.setHeader('content-type', 'text/calendar; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="${calendar.filename}"`);
    res.status(200).send(calendar.content);
  } catch (error) {
    next(error);
  }
}

export async function getInterviewMeeting(req, res, next) {
  try {
    const result = await getOrganisationInterviewMeeting(req.user, req.params.roundId, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function listInterviewMeetings(req, res, next) {
  try {
    const result = await listOrganisationInterviewMeetings(req.user, req.query, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function listAssignedInterviewMeetings(req, res, next) {
  try {
    const result = await listInterviewerAssignedMeetings(req.user, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function previewInterviewAvailability(req, res, next) {
  try {
    const result = await checkInterviewAvailability(req.user, req.body, req.user.activeMembership?.organisationId);
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function createInterviewerRescheduleRequest(req, res, next) {
  try {
    const result = await submitInterviewRescheduleRequest({
      actorUser: req.user,
      roundId: req.params.roundId,
      payload: req.body,
      organisationId: req.user.activeMembership?.organisationId,
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

export async function withdrawInterviewerRescheduleRequest(req, res, next) {
  try {
    const result = await withdrawInterviewRescheduleRequest({
      actorUser: req.user,
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

export async function reviewRescheduleRequest(req, res, next) {
  try {
    const result = await reviewInterviewRescheduleRequest(
      req.user,
      req.params.requestId,
      req.body,
      req.user.activeMembership?.organisationId,
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    );
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function downloadCandidateRoundCalendar(req, res, next) {
  try {
    const calendar = await downloadCandidateInterviewCalendar(req.user, req.params.roundId);
    res.setHeader('content-type', 'text/calendar; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="${calendar.filename}"`);
    res.status(200).send(calendar.content);
  } catch (error) {
    next(error);
  }
}
