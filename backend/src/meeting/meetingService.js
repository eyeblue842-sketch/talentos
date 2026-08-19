import crypto from 'crypto';
import { env } from '../config/env.js';
import { requireEnterprisePermission } from '../services/enterprisePermissionService.js';
import { requireOrganisationRole } from '../services/organisationAccessService.js';
import { recordAuditLog } from '../services/auditLogService.js';
import { createNotification } from '../services/notificationService.js';
import { enqueueBackgroundTask, cancelBackgroundTasks } from '../services/backgroundTaskService.js';
import { buildInterviewCalendarFile } from './calendarService.js';
import {
  assertFutureSchedule,
  assertValidTimezone,
  buildUtcDate,
  ensureHttpsUrl,
  ensureSupportedMeetingProvider,
  sanitizeMeetingText,
} from './meetingValidation.js';
import { getMeetingProvider } from './providers/meetingProviderFactory.js';
import { getUsableMeetingConnection, resolveMeetingProviderAccessToken } from './meetingConnectionService.js';
import {
  interviewReadableRoles,
  meetingReminderWindows,
} from './meetingConstants.js';
import {
  cancelInterviewMeetingRecord,
  createInterviewRescheduleRequestRecord,
  findActiveInterviewParticipantMemberships,
  findCandidateRoundForCalendar,
  findInterviewMeetingWithScheduleDetails,
  findInterviewRescheduleRequestForReview,
  findInterviewRescheduleRequestWithOptions,
  findInterviewRoundForCalendarDownload,
  findInterviewRoundForOrganisationReschedule,
  findInterviewRoundForScheduling,
  findInterviewRoundForCandidateReschedule,
  findMeetingWithContext,
  findOrganisationInterviewMeetings as findOrganisationInterviewMeetingsRecords,
  findOrganisationRoundMeetingReference,
  findOrganisationSchedulingSettingsRecord,
  findOverlappingInterviewMeetings,
  findPanelMembershipsWithUsers,
  findPendingInterviewRescheduleRequestByRequester,
  findPendingInterviewRescheduleRequestForRequester,
  findInterviewerAssignedMeetings as findInterviewerAssignedMeetingRecords,
  markInterviewRescheduleRequestApproved,
  markMeetingProviderFailure,
  persistMeetingSuccessRecord,
  prepareInterviewMeeting,
  rejectInterviewRescheduleRequestRecord,
  updateInterviewMeetingStatus,
  updateInterviewRescheduleRequest,
} from '../repositories/meeting/meetingRepository.js';

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 422;
  return error;
}

function conflictError(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

function iso(value) {
  return value?.toISOString?.() || value || null;
}

function buildSafeMeetingDescription(round, meetingInput) {
  return [
    `Interview round: ${round.roundName}`,
    meetingInput.candidateInstructions ? `Instructions: ${meetingInput.candidateInstructions}` : null,
    meetingInput.location ? `Location: ${meetingInput.location}` : null,
    meetingInput.safeJoinUrl ? `Join link: ${meetingInput.safeJoinUrl}` : null,
    meetingInput.dialInInformation ? `Dial-in: ${meetingInput.dialInInformation}` : null,
  ].filter(Boolean).join('\n');
}

function getSchedulingSettings(settings) {
  return {
    defaultMeetingProvider: settings?.defaultMeetingProvider || 'CUSTOM',
    allowedProviders: settings?.allowedProviders?.length ? settings.allowedProviders : ['CUSTOM'],
    defaultInterviewDuration: settings?.defaultInterviewDuration || 60,
    workingDays: Array.isArray(settings?.workingDays) ? settings.workingDays : [1, 2, 3, 4, 5],
    workingHours: settings?.workingHours || { start: '09:00', end: '18:00' },
    minimumSchedulingNoticeMinutes: Number(settings?.minimumSchedulingNoticeMinutes || 0),
    candidateRescheduleEnabled: settings?.candidateRescheduleEnabled !== false,
    interviewerRescheduleEnabled: settings?.interviewerRescheduleEnabled !== false,
    maximumCandidateRequests: Number(settings?.maximumCandidateRequests ?? 3),
    maximumRescheduleCount: Number(settings?.maximumRescheduleCount ?? 10),
    rescheduleCutoffMinutes: Number(settings?.rescheduleCutoffMinutes ?? 30),
    reminderIntervalsMinutes: Array.isArray(settings?.reminderIntervalsMinutes) && settings.reminderIntervalsMinutes.length
      ? settings.reminderIntervalsMinutes
      : meetingReminderWindows.map((item) => item.offsetMinutes),
    includeRecruiterInInvite: settings?.includeRecruiterInInvite !== false,
    includeCoordinatorInInvite: settings?.includeCoordinatorInInvite !== false,
    allowAvailabilityChecks: settings?.allowAvailabilityChecks !== false,
    allowManualCustomLink: settings?.allowManualCustomLink !== false,
    zoomWaitingRoomDefault: settings?.zoomWaitingRoomDefault !== false,
    cancellationReasonRequired: settings?.cancellationReasonRequired !== false,
  };
}

async function getOrganisationSchedulingSettings(organisationId) {
  let settings = null;
  try {
    settings = await findOrganisationSchedulingSettingsRecord(organisationId);
  } catch (error) {
    if (error?.code !== 'P2021') {
      throw error;
    }
  }
  return getSchedulingSettings(settings?.interviewSchedulingSettings || {});
}

async function getRoundForScheduling(organisationId, applicationId, roundId) {
  const round = await findInterviewRoundForScheduling(organisationId, applicationId, roundId);

  if (!round) {
    const error = new Error('Interview round not found.');
    error.statusCode = 404;
    throw error;
  }

  return round;
}

async function assertInterviewParticipantMemberships(organisationId, participants) {
  const requiredUserIds = participants
    .map((item) => item.userId)
    .filter(Boolean);

  if (!requiredUserIds.length) return;

  const memberships = await findActiveInterviewParticipantMemberships(organisationId, requiredUserIds);

  if (memberships.length !== requiredUserIds.length) {
    throw badRequest('Interview participants must belong to the organisation and hold interview-eligible roles.');
  }
}

function buildParticipantSnapshot(participants = []) {
  return participants.map((item) => ({
    email: item.email,
    role: item.participantRole,
    required: item.required,
    userId: item.userId || null,
    candidateId: item.candidateId || null,
  }));
}

function dedupeParticipants(participants = []) {
  const map = new Map();
  for (const participant of participants) {
    if (!participant.email) continue;
    map.set(participant.email.toLowerCase(), {
      ...participant,
      email: participant.email.toLowerCase(),
    });
  }
  return [...map.values()];
}

function buildMeetingParticipants(round, meetingInput, actorUser) {
  const application = round.interviewProcess?.application || {};
  const participants = [
    application.candidate?.user?.email ? {
      email: application.candidate.user.email,
      candidateId: application.candidate.id,
      participantRole: 'CANDIDATE',
      required: true,
      displayName: application.candidate.fullName,
    } : null,
    ...(meetingInput.panelMembers || []).map((member) => ({
      email: member.email,
      userId: member.userId,
      participantRole: member.isLead ? 'LEAD_INTERVIEWER' : member.isObserver ? 'OBSERVER' : 'INTERVIEWER',
      required: member.feedbackRequired !== false,
      displayName: member.email,
    })),
    meetingInput.coordinatorUser?.email ? {
      email: meetingInput.coordinatorUser.email,
      userId: meetingInput.coordinatorUser.id,
      participantRole: 'COORDINATOR',
      required: false,
      displayName: meetingInput.coordinatorUser.email,
    } : null,
    (meetingInput.includeRecruiterInInvite && actorUser?.email) ? {
      email: actorUser.email,
      userId: actorUser.id,
      participantRole: 'RECRUITER',
      required: false,
      displayName: actorUser.email,
    } : null,
  ].filter(Boolean);

  return dedupeParticipants(participants);
}

async function cancelReminderTasks(reminders, actorUserId = null) {
  const taskIds = reminders.map((item) => item.backgroundTaskId).filter(Boolean);
  if (!taskIds.length) return;
  await cancelBackgroundTasks({
    id: { in: taskIds },
  }, actorUserId, 'MEETING_REMINDER_CANCELLED');
}

async function enqueueReminderTask({ reminder, meeting, participant, offsetMinutes, actorUserId }) {
  const task = await enqueueBackgroundTask({
    organisationId: meeting.organisationId,
    type: 'INTERVIEW_REMINDER',
    entityType: 'MeetingReminder',
    entityId: reminder.id,
    idempotencyKey: `meeting-reminder:${meeting.id}:${participant.id}:${offsetMinutes}:${meeting.operationVersion}`,
    payload: {
      reminderId: reminder.id,
      meetingId: meeting.id,
    },
    nextAttemptAt: reminder.scheduledFor,
    createdByUserId: actorUserId,
  });

  return task.id;
}

async function createMeetingNotifications(application, title, message, participants, metadata = {}) {
  const writes = [];
  for (const participant of participants) {
    if (!participant.userId) continue;
    writes.push(createNotification({
      organisationId: application.organisationId,
      recipientUserId: participant.userId,
      type: 'INTERVIEW',
      title,
      message,
      entityType: 'InterviewRound',
      entityId: metadata.roundId || null,
      metadata,
    }));
  }

  return Promise.all(writes);
}

function buildMeetingInput(round, payload, settings, actorUser) {
  const timezone = payload.timezone || round.timezone || 'UTC';
  assertValidTimezone(timezone);
  const scheduledStartUtc = buildUtcDate(payload.scheduledStartAt, 'Scheduled start');
  const scheduledEndUtc = buildUtcDate(payload.scheduledEndAt, 'Scheduled end');
  const durationMinutes = payload.durationMinutes || assertFutureSchedule(scheduledStartUtc, scheduledEndUtc);

  if (!env.isTest && (scheduledStartUtc.getTime() - Date.now()) < (settings.minimumSchedulingNoticeMinutes * 60 * 1000)) {
    throw badRequest('Interview does not satisfy the minimum scheduling notice period.');
  }

  const mode = payload.meetingMode || round.meetingMode || 'VIRTUAL';
  const provider = mode === 'VIRTUAL'
    ? (payload.meetingProvider || settings.defaultMeetingProvider || 'CUSTOM')
    : 'CUSTOM';

  ensureSupportedMeetingProvider(provider);

  if (!settings.allowedProviders.includes(provider)) {
    throw badRequest('This meeting provider is not allowed by organisation settings.');
  }

  return {
    provider,
    mode,
    timezone,
    scheduledStartUtc,
    scheduledEndUtc,
    durationMinutes,
    title: `${round.interviewProcess?.application?.job?.title || 'Careeriz interview'} - ${round.roundName}`,
    location: sanitizeMeetingText(payload.meetingLocation || payload.location, 300),
    officeAddress: sanitizeMeetingText(payload.officeAddress, 500),
    dialInInformation: sanitizeMeetingText(payload.dialInInformation, 1000),
    providerDisplayName: sanitizeMeetingText(payload.providerDisplayName, 120),
    instructions: sanitizeMeetingText(payload.instructions || payload.notes, 3000),
    candidateInstructions: sanitizeMeetingText(payload.candidateInstructions, 2000),
    internalNotes: sanitizeMeetingText(payload.internalNotes || payload.notes, 4000),
    safeJoinUrl: mode === 'VIRTUAL' ? ensureHttpsUrl(payload.meetingLink || payload.safeJoinUrl) : null,
    passcode: sanitizeMeetingText(payload.passcode, 120),
    waitingRoomEnabled: payload.waitingRoomEnabled ?? settings.zoomWaitingRoomDefault,
    includeRecruiterInInvite: payload.includeRecruiterInInvite ?? settings.includeRecruiterInInvite,
    panelMembers: payload.panelMembers || [],
    coordinatorUser: payload.coordinatorUser || null,
    candidateDescription: null,
    actorUser,
  };
}

async function callProviderOperation(providerName, connection, operation, args) {
  const provider = getMeetingProvider(providerName, connection);
  if (providerName === 'CUSTOM') {
    return provider[operation](args);
  }

  const { accessToken, connection: refreshedConnection } = await resolveMeetingProviderAccessToken(connection);
  return provider[operation]({ ...args, accessToken, connection: refreshedConnection });
}

export async function checkInterviewAvailability(actorUser, payload, organisationId = null) {
  const context = await requireEnterprisePermission(actorUser, 'interview.view', organisationId);
  const startUtc = buildUtcDate(payload.scheduledStartAt, 'Scheduled start');
  const endUtc = buildUtcDate(payload.scheduledEndAt, 'Scheduled end');
  assertValidTimezone(payload.timezone);

  const participants = payload.panelMembers || [];
  const requiredUserIds = participants.filter((item) => item.feedbackRequired !== false).map((item) => item.userId);
  const optionalUserIds = participants.filter((item) => item.feedbackRequired === false).map((item) => item.userId);

  const overlapping = await findOverlappingInterviewMeetings(
    context.organisationId,
    startUtc,
    endUtc,
    [...requiredUserIds, ...optionalUserIds],
  );

  let external = { providerChecked: false, participants: [], suggestions: [] };
  const provider = payload.meetingProvider || 'CUSTOM';
  if (provider === 'GOOGLE_MEET') {
    try {
      const connection = await getUsableMeetingConnection(context.organisationId, provider);
      const { accessToken } = await resolveMeetingProviderAccessToken(connection);
      external = await getMeetingProvider(provider, connection).checkAvailability({
        accessToken,
        attendees: participants.map((item) => ({ email: item.email || '' })).filter((item) => item.email),
        startUtc,
        endUtc,
      });
    } catch {
      external = { providerChecked: false, participants: [], suggestions: [] };
    }
  }

  return {
    timezone: payload.timezone,
    providerChecked: external.providerChecked,
    careerizConflicts: overlapping.map((meeting) => ({
      meetingId: meeting.id,
      roundName: meeting.interviewRound.roundName,
      startUtc: iso(meeting.scheduledStartUtc),
      endUtc: iso(meeting.scheduledEndUtc),
      participants: meeting.participants.map((participant) => participant.email),
    })),
    externalConflicts: external.participants || [],
    warnings: [
      ...requiredUserIds.length && overlapping.length ? ['Required interviewer conflicts detected in Careeriz.'] : [],
      ...optionalUserIds.length && overlapping.length ? ['Optional interviewer conflicts detected in Careeriz.'] : [],
      ...(!external.providerChecked && provider !== 'CUSTOM') ? ['External calendar availability could not be verified for this provider.'] : [],
    ],
  };
}

export async function scheduleInterviewMeeting(applicationId, actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'interview.schedule', organisationId);
  const round = await getRoundForScheduling(context.organisationId, applicationId, payload.roundId);
  const settings = await getOrganisationSchedulingSettings(context.organisationId);
  const meetingInput = buildMeetingInput(round, payload, settings, actorUser);

  if (round.status === 'COMPLETED' || round.status === 'CANCELLED') {
    throw badRequest('This interview round can no longer be scheduled.');
  }

  if ((round.meeting?.rescheduleCount || 0) >= settings.maximumRescheduleCount && round.meeting?.status === 'SCHEDULED') {
    throw badRequest('This interview has reached the maximum reschedule count.');
  }

  const memberships = await findPanelMembershipsWithUsers(
    context.organisationId,
    (payload.panelMembers || []).map((item) => item.userId).filter(Boolean),
  );
  const membershipByUserId = new Map(memberships.map((item) => [item.userId, item]));
  meetingInput.panelMembers = (payload.panelMembers || []).map((item) => ({
    ...item,
    email: membershipByUserId.get(item.userId)?.user?.email || item.email,
  }));
  await assertInterviewParticipantMemberships(context.organisationId, meetingInput.panelMembers);

  const participants = buildMeetingParticipants(round, meetingInput, actorUser);
  const operationKey = crypto.randomUUID();

  const existingMeeting = round.meeting;
  const preparedMeeting = await prepareInterviewMeeting(
    existingMeeting,
    {
      organisationId: context.organisationId,
      interviewRoundId: round.id,
      provider: meetingInput.provider,
      mode: meetingInput.mode,
      status: 'SCHEDULING',
      timezone: meetingInput.timezone,
      scheduledStartUtc: meetingInput.scheduledStartUtc,
      scheduledEndUtc: meetingInput.scheduledEndUtc,
      durationMinutes: meetingInput.durationMinutes,
      providerOperationKey: operationKey,
      createdByUserId: actorUser.id,
      updatedByUserId: actorUser.id,
      candidateInstructions: meetingInput.candidateInstructions,
      instructions: meetingInput.instructions,
      internalNotes: meetingInput.internalNotes,
    },
    {
      status: existingMeeting?.status === 'SCHEDULED' ? 'RESCHEDULING' : 'SCHEDULING',
      providerOperationKey: operationKey,
      updatedByUserId: actorUser.id,
    },
  );

  meetingInput.candidateDescription = buildSafeMeetingDescription(round, meetingInput);

  try {
    let providerResult;
    if (meetingInput.provider === 'CUSTOM' || meetingInput.mode !== 'VIRTUAL') {
      providerResult = await callProviderOperation('CUSTOM', null, existingMeeting?.status === 'SCHEDULED' ? 'updateMeeting' : 'createMeeting', {
        meetingInput,
      });
    } else if (!existingMeeting || existingMeeting.provider !== meetingInput.provider || !existingMeeting.externalMeetingId) {
      const connection = await getUsableMeetingConnection(context.organisationId, meetingInput.provider);
      providerResult = await callProviderOperation(meetingInput.provider, connection, 'createMeeting', {
        meetingInput,
        attendees: participants,
        externalId: operationKey,
      });
    } else {
      const connection = await getUsableMeetingConnection(context.organisationId, meetingInput.provider);
      providerResult = await callProviderOperation(meetingInput.provider, connection, 'updateMeeting', {
        meeting: existingMeeting,
        meetingInput,
        attendees: participants,
      });
    }

    const { updatedMeeting } = await persistMeetingSuccessRecord({
      meetingId: preparedMeeting.id,
      meetingInput,
      providerResult,
      participants,
      actorUserId: actorUser.id,
      round,
      existingMeeting,
      historyAction: existingMeeting?.status === 'SCHEDULED' ? 'RESCHEDULED' : 'SCHEDULED',
      reminderIntervalsMinutes: settings.reminderIntervalsMinutes,
      oldParticipantSnapshot: buildParticipantSnapshot(existingMeeting?.participants || []),
      newParticipantSnapshot: buildParticipantSnapshot(participants),
      onCancelReminderTasks: (reminders) => cancelReminderTasks(reminders, actorUser.id),
      onCreateReminderTask: enqueueReminderTask,
    });

    await createMeetingNotifications(
      round.interviewProcess.application,
      existingMeeting?.status === 'SCHEDULED' ? 'Interview rescheduled' : 'Interview scheduled',
      `${round.roundName} is scheduled for ${meetingInput.scheduledStartUtc.toLocaleString('en-US', { timeZone: meetingInput.timezone })}.`,
      participants,
      {
        roundId: round.id,
        meetingId: updatedMeeting.id,
        provider: meetingInput.provider,
      },
    );

    await recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: existingMeeting?.status === 'SCHEDULED' ? 'interview.meeting.reschedule' : 'interview.meeting.schedule',
      entityType: 'InterviewMeeting',
      entityId: preparedMeeting.id,
      beforeData: existingMeeting ? {
        scheduledStartUtc: existingMeeting.scheduledStartUtc,
        scheduledEndUtc: existingMeeting.scheduledEndUtc,
        provider: existingMeeting.provider,
      } : null,
      afterData: {
        scheduledStartUtc: meetingInput.scheduledStartUtc,
        scheduledEndUtc: meetingInput.scheduledEndUtc,
        provider: meetingInput.provider,
        participantCount: participants.length,
      },
      metadata: {
        roundId: round.id,
        applicationId,
      },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return findInterviewMeetingWithScheduleDetails(preparedMeeting.id);
  } catch (error) {
    await markMeetingProviderFailure(preparedMeeting.id, error, actorUser.id);
    throw error;
  }
}

export async function cancelInterviewMeeting(applicationId, actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'interview.cancel', organisationId);
  const round = await getRoundForScheduling(context.organisationId, applicationId, payload.roundId);
  const meeting = round.meeting;

  if (!meeting) {
    throw badRequest('This interview has not been scheduled yet.');
  }

  if (meeting.status === 'CANCELLED') {
    return meeting;
  }

  if (!payload.cancelReason) {
    throw badRequest('Cancellation reason is required.');
  }

  try {
    if (meeting.provider && meeting.provider !== 'CUSTOM' && meeting.externalMeetingId) {
      const connection = await getUsableMeetingConnection(context.organisationId, meeting.provider);
      await callProviderOperation(meeting.provider, connection, 'cancelMeeting', { meeting });
    }

    await cancelInterviewMeetingRecord({
      meeting,
      round,
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      cancelReason: payload.cancelReason,
      onCancelReminderTasks: (reminders) => cancelReminderTasks(reminders, actorUser.id),
    });

    await createMeetingNotifications(
      round.interviewProcess.application,
      'Interview cancelled',
      `${round.roundName} has been cancelled.`,
      meeting.participants || [],
      {
        roundId: round.id,
        meetingId: meeting.id,
      },
    );

    await recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: 'interview.meeting.cancel',
      entityType: 'InterviewMeeting',
      entityId: meeting.id,
      metadata: {
        roundId: round.id,
        applicationId,
        cancelReason: payload.cancelReason,
      },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return findInterviewMeetingWithScheduleDetails(meeting.id);
  } catch (error) {
    await markMeetingProviderFailure(meeting.id, error, actorUser.id);
    throw error;
  }
}

export async function downloadInterviewCalendar(actorUser, roundId, organisationId = null) {
  const context = await requireOrganisationRole(actorUser, interviewReadableRoles, organisationId);
  const round = await findInterviewRoundForCalendarDownload(context.organisationId, roundId);

  if (!round?.meeting) {
    const error = new Error('Interview meeting not found.');
    error.statusCode = 404;
    throw error;
  }

  const application = round.interviewProcess.application;
  const ics = buildInterviewCalendarFile({
    uid: `${round.meeting.id}@careeriz`,
    method: round.meeting.status === 'CANCELLED' ? 'CANCEL' : 'REQUEST',
    sequence: Math.max(0, round.meeting.operationVersion - 1),
    summary: `${application.job.title} - ${round.roundName}`,
    description: buildSafeMeetingDescription(round, {
      candidateInstructions: round.meeting.candidateInstructions,
      location: round.meeting.location,
      safeJoinUrl: round.meeting.safeJoinUrl,
      dialInInformation: round.meeting.dialInInformation,
    }),
    location: round.meeting.officeAddress || round.meeting.location || round.meeting.safeJoinUrl || 'Careeriz interview',
    startUtc: round.meeting.scheduledStartUtc,
    endUtc: round.meeting.scheduledEndUtc,
    organizer: {
      email: application.job.recruiterId ? undefined : undefined,
      name: 'Careeriz',
    },
    attendees: (round.meeting.participants || []).map((participant) => ({
      email: participant.email,
      role: participant.required ? 'REQ-PARTICIPANT' : 'OPT-PARTICIPANT',
    })),
    status: round.meeting.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED',
    url: round.meeting.safeJoinUrl,
  });

  return {
    filename: `${application.job.title}-${round.roundName}.ics`.replace(/[^A-Za-z0-9._-]+/g, '-'),
    content: ics,
  };
}

export async function submitInterviewRescheduleRequest({ actorUser = null, candidateUser = null, roundId, payload, organisationId = null, requestMeta = {} }) {
  const round = candidateUser
    ? await findInterviewRoundForCandidateReschedule(roundId, candidateUser.candidateProfile.id)
    : await findInterviewRoundForOrganisationReschedule(roundId, organisationId);

  if (!round?.meeting) {
    const error = new Error('Interview meeting not found.');
    error.statusCode = 404;
    throw error;
  }

  const settings = await getOrganisationSchedulingSettings(round.organisationId);
  const requesterType = candidateUser ? 'CANDIDATE' : 'INTERVIEWER';
  if (candidateUser && !settings.candidateRescheduleEnabled) {
    throw badRequest('Candidate reschedule requests are disabled for this organisation.');
  }
  if (actorUser && !settings.interviewerRescheduleEnabled) {
    throw badRequest('Interviewer reschedule requests are disabled for this organisation.');
  }

  const existingPending = await findPendingInterviewRescheduleRequestForRequester(
    round.meeting.id,
    candidateUser?.candidateProfile.id || null,
    actorUser?.id || null,
  );
  if (existingPending) {
    throw conflictError('A pending reschedule request already exists.');
  }

  const request = await createInterviewRescheduleRequestRecord({
    organisationId: round.organisationId,
    meetingId: round.meeting.id,
    requesterType,
    requestedByUserId: actorUser?.id || null,
    candidateId: candidateUser?.candidateProfile.id || null,
    reasonCode: payload.reasonCode || 'OTHER',
    reasonText: sanitizeMeetingText(payload.reasonText, 1000),
    preferredTimezone: payload.preferredTimezone || round.meeting.timezone,
    options: (payload.options || []).slice(0, 3).map((option, index) => ({
      proposedStartUtc: buildUtcDate(option.proposedStartUtc, 'Preferred start'),
      proposedEndUtc: buildUtcDate(option.proposedEndUtc, 'Preferred end'),
      timezone: option.timezone || payload.preferredTimezone || round.meeting.timezone,
      priority: index + 1,
    })),
  });

  await updateInterviewMeetingStatus(round.meeting.id, { status: 'RESCHEDULE_REQUESTED' });

  await recordAuditLog({
    organisationId: round.organisationId,
    actorUserId: actorUser?.id || candidateUser?.id || null,
    action: 'interview.reschedule-request.create',
    entityType: 'InterviewRescheduleRequest',
    entityId: request.id,
    metadata: {
      roundId,
      requesterType,
    },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return request;
}

export async function withdrawInterviewRescheduleRequest({ actorUser = null, candidateUser = null, requestId, requestMeta = {} }) {
  const request = await findPendingInterviewRescheduleRequestByRequester(
    requestId,
    candidateUser?.candidateProfile.id || null,
    actorUser?.id || null,
  );
  if (!request) {
    const error = new Error('Pending reschedule request not found.');
    error.statusCode = 404;
    throw error;
  }

  const updated = await updateInterviewRescheduleRequest(request.id, { status: 'WITHDRAWN' });

  await recordAuditLog({
    organisationId: request.organisationId,
    actorUserId: actorUser?.id || candidateUser?.id || null,
    action: 'interview.reschedule-request.withdraw',
    entityType: 'InterviewRescheduleRequest',
    entityId: request.id,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return updated;
}

export async function listOrganisationInterviewMeetings(actorUser, filters = {}, organisationId = null) {
  const context = await requireEnterprisePermission(actorUser, 'interview.view', organisationId);
  const where = {
    organisationId: context.organisationId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.provider ? { provider: filters.provider } : {}),
    ...(filters.roundId ? { interviewRoundId: filters.roundId } : {}),
    ...(filters.from || filters.to ? {
      scheduledStartUtc: {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      },
    } : {}),
    ...(filters.userId ? {
      participants: { some: { userId: filters.userId } },
    } : {}),
  };

  return findOrganisationInterviewMeetingsRecords(where);
}

export async function getOrganisationInterviewMeeting(actorUser, roundId, organisationId = null) {
  const context = await requireEnterprisePermission(actorUser, 'interview.view', organisationId);
  const round = await findOrganisationRoundMeetingReference(roundId, context.organisationId);

  if (!round?.meeting?.id) {
    const error = new Error('Interview meeting not found.');
    error.statusCode = 404;
    throw error;
  }

  return findMeetingWithContext(round.meeting.id);
}

export async function listInterviewerAssignedMeetings(actorUser, organisationId = null) {
  const context = await requireEnterprisePermission(actorUser, 'interview.view', organisationId);
  return findInterviewerAssignedMeetingRecords(context.organisationId, actorUser.id);
}

export async function downloadCandidateInterviewCalendar(candidateUser, roundId) {
  const round = await findCandidateRoundForCalendar(roundId, candidateUser.candidateProfile.id);

  if (!round?.meeting) {
    const error = new Error('Interview meeting not found.');
    error.statusCode = 404;
    throw error;
  }

  return {
    filename: `${round.interviewProcess.application.job.title}-${round.roundName}.ics`.replace(/[^A-Za-z0-9._-]+/g, '-'),
    content: buildInterviewCalendarFile({
      uid: `${round.meeting.id}@careeriz`,
      method: round.meeting.status === 'CANCELLED' ? 'CANCEL' : 'REQUEST',
      sequence: Math.max(0, round.meeting.operationVersion - 1),
      summary: `${round.interviewProcess.application.job.title} - ${round.roundName}`,
      description: buildSafeMeetingDescription(round, {
        candidateInstructions: round.meeting.candidateInstructions,
        location: round.meeting.location,
        safeJoinUrl: round.meeting.safeJoinUrl,
        dialInInformation: round.meeting.dialInInformation,
      }),
      location: round.meeting.officeAddress || round.meeting.location || round.meeting.safeJoinUrl || 'Careeriz interview',
      startUtc: round.meeting.scheduledStartUtc,
      endUtc: round.meeting.scheduledEndUtc,
      organizer: { name: 'Careeriz' },
      attendees: [{
        email: candidateUser.email,
        role: 'REQ-PARTICIPANT',
      }],
      status: round.meeting.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED',
      url: round.meeting.safeJoinUrl,
    }),
  };
}

export async function reviewInterviewRescheduleRequest(actorUser, requestId, payload, organisationId = null, requestMeta = {}) {
  const context = await requireEnterprisePermission(actorUser, 'interview.reviewRescheduleRequest', organisationId);
  const request = await findInterviewRescheduleRequestForReview(requestId, context.organisationId);

  if (!request?.meeting?.interviewRound?.interviewProcess?.application) {
    const error = new Error('Pending reschedule request not found.');
    error.statusCode = 404;
    throw error;
  }

  if (payload.decision === 'REJECT') {
    const updated = await rejectInterviewRescheduleRequestRecord(
      request,
      actorUser.id,
      sanitizeMeetingText(payload.reason, 1000),
    );

    await recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: 'interview.reschedule-request.reject',
      entityType: 'InterviewRescheduleRequest',
      entityId: request.id,
      metadata: {
        roundId: payload.roundId,
      },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return updated;
  }

  const approvedOption = request.options[0];
  const panelMembers = (payload.panelMembers?.length ? payload.panelMembers : request.meeting.participants
    .filter((participant) => participant.userId && ['INTERVIEWER', 'LEAD_INTERVIEWER', 'OBSERVER'].includes(participant.participantRole))
    .map((participant) => ({
      userId: participant.userId,
      isLead: participant.participantRole === 'LEAD_INTERVIEWER',
      isObserver: participant.participantRole === 'OBSERVER',
      feedbackRequired: participant.required,
    })));

  const scheduledStartAt = payload.scheduledStartAt || approvedOption?.proposedStartUtc?.toISOString?.();
  const scheduledEndAt = payload.scheduledEndAt || approvedOption?.proposedEndUtc?.toISOString?.();
  const timezone = payload.timezone || approvedOption?.timezone || request.preferredTimezone || request.meeting.timezone;

  if (!scheduledStartAt || !scheduledEndAt) {
    throw badRequest('An approved reschedule requires a scheduled start and end time.');
  }

  const meeting = await scheduleInterviewMeeting(
    request.meeting.interviewRound.interviewProcess.application.id,
    actorUser,
    {
      roundId: request.meeting.interviewRoundId,
      interviewType: request.meeting.interviewRound.interviewType,
      scheduledStartAt,
      scheduledEndAt,
      timezone,
      meetingMode: request.meeting.mode,
      meetingProvider: payload.meetingProvider || request.meeting.provider || 'CUSTOM',
      panelMembers,
      meetingLocation: request.meeting.location,
      meetingLink: request.meeting.safeJoinUrl,
      officeAddress: request.meeting.officeAddress,
      dialInInformation: request.meeting.dialInInformation,
      providerDisplayName: request.meeting.providerDisplayName,
      candidateInstructions: request.meeting.candidateInstructions,
      notes: payload.reason || request.reasonText || request.meeting.instructions,
      durationMinutes: request.meeting.durationMinutes,
    },
    context.organisationId,
    requestMeta,
  );

  await markInterviewRescheduleRequestApproved(
    request.id,
    actorUser.id,
    sanitizeMeetingText(payload.reason, 1000),
  );

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'interview.reschedule-request.approve',
    entityType: 'InterviewRescheduleRequest',
    entityId: request.id,
    metadata: {
      meetingId: request.interviewMeetingId,
      approvedMeetingId: meeting?.id || null,
    },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return findInterviewRescheduleRequestWithOptions(request.id);
}
