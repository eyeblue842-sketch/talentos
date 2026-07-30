import { prisma } from '../../config/db.js';

export function findOrganisationSchedulingSettingsRecord(organisationId) {
  return prisma.organisationSettings.findUnique({
    where: { organisationId },
  });
}

export function findInterviewRoundForScheduling(organisationId, applicationId, roundId) {
  return prisma.interviewRound.findFirst({
    where: {
      id: roundId,
      organisationId,
      interviewProcess: { applicationId },
    },
    include: {
      owner: true,
      panelMembers: { include: { user: true } },
      meeting: {
        include: {
          participants: true,
          reminders: true,
        },
      },
      interviewProcess: {
        include: {
          application: {
            include: {
              candidate: { include: { user: true } },
              job: true,
              submittedApplication: true,
            },
          },
        },
      },
    },
  });
}

export function findActiveInterviewParticipantMemberships(organisationId, requiredUserIds) {
  return prisma.organisationMembership.findMany({
    where: {
      organisationId,
      userId: { in: requiredUserIds },
      status: 'ACTIVE',
      role: { in: ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER'] },
    },
  });
}

export function findPanelMembershipsWithUsers(organisationId, userIds) {
  return prisma.organisationMembership.findMany({
    where: {
      organisationId,
      userId: { in: userIds },
      status: 'ACTIVE',
    },
    include: { user: true },
  });
}

export function findOverlappingInterviewMeetings(organisationId, startUtc, endUtc, userIds) {
  return prisma.interviewMeeting.findMany({
    where: {
      organisationId,
      status: { in: ['SCHEDULED', 'RESCHEDULE_REQUESTED', 'RESCHEDULING'] },
      scheduledStartUtc: { lt: endUtc },
      scheduledEndUtc: { gt: startUtc },
      participants: {
        some: {
          userId: { in: userIds },
        },
      },
    },
    include: {
      participants: true,
      interviewRound: true,
    },
  });
}

export function prepareInterviewMeeting(existingMeeting, createData, updateData) {
  return existingMeeting
    ? prisma.interviewMeeting.update({
        where: { id: existingMeeting.id },
        data: updateData,
        include: { participants: true, reminders: true },
      })
    : prisma.interviewMeeting.create({
        data: createData,
        include: { participants: true, reminders: true },
      });
}

async function createOrReplaceMeetingParticipants(tx, meetingId, organisationId, participants) {
  await tx.meetingParticipant.deleteMany({
    where: { meetingId },
  });

  if (!participants.length) return [];

  await tx.meetingParticipant.createMany({
    data: participants.map((participant) => ({
      organisationId,
      meetingId,
      userId: participant.userId || null,
      candidateId: participant.candidateId || null,
      email: participant.email,
      participantRole: participant.participantRole,
      required: participant.required !== false,
    })),
  });

  return tx.meetingParticipant.findMany({
    where: { meetingId },
    orderBy: [{ createdAt: 'asc' }],
  });
}

async function findScheduledMeetingRemindersTx(tx, meetingId) {
  return tx.meetingReminder.findMany({
    where: {
      interviewMeetingId: meetingId,
      status: 'SCHEDULED',
    },
  });
}

async function cancelMeetingRemindersTx(tx, meetingId) {
  const reminders = await findScheduledMeetingRemindersTx(tx, meetingId);

  if (!reminders.length) return [];

  await tx.meetingReminder.updateMany({
    where: { id: { in: reminders.map((item) => item.id) } },
    data: { status: 'CANCELLED' },
  });

  return reminders;
}

export async function persistMeetingSuccessRecord({
  meetingId,
  meetingInput,
  providerResult,
  participants,
  actorUserId,
  round,
  existingMeeting,
  historyAction,
  reminderIntervalsMinutes,
  oldParticipantSnapshot,
  newParticipantSnapshot,
  onCancelReminderTasks,
  onCreateReminderTask,
}) {
  return prisma.$transaction(async (tx) => {
    const hadPreviousSchedule = Boolean(existingMeeting?.scheduledStartUtc && existingMeeting?.scheduledEndUtc);
    const updatedMeeting = await tx.interviewMeeting.update({
      where: { id: meetingId },
      data: {
        provider: meetingInput.provider,
        mode: meetingInput.mode,
        status: 'SCHEDULED',
        externalMeetingId: providerResult.externalMeetingId || null,
        externalCalendarEventId: providerResult.externalCalendarEventId || null,
        conferenceId: providerResult.conferenceId || null,
        safeJoinUrl: providerResult.safeJoinUrl || meetingInput.safeJoinUrl || null,
        encryptedHostUrl: providerResult.encryptedHostUrl || null,
        passcodeMetadata: providerResult.passcodeMetadata || (meetingInput.passcode ? { passcodeSet: true } : null),
        timezone: meetingInput.timezone,
        scheduledStartUtc: meetingInput.scheduledStartUtc,
        scheduledEndUtc: meetingInput.scheduledEndUtc,
        durationMinutes: meetingInput.durationMinutes,
        location: meetingInput.location,
        officeAddress: meetingInput.officeAddress,
        dialInInformation: meetingInput.dialInInformation,
        providerDisplayName: meetingInput.providerDisplayName || meetingInput.provider,
        instructions: meetingInput.instructions,
        candidateInstructions: meetingInput.candidateInstructions,
        internalNotes: meetingInput.internalNotes,
        providerMetadata: providerResult.providerMetadata || {},
        providerLastSyncedAt: new Date(),
        providerFailureCode: null,
        providerFailureMessage: null,
        rescheduleCount: hadPreviousSchedule ? { increment: 1 } : undefined,
        lastRescheduledAt: hadPreviousSchedule ? new Date() : existingMeeting?.lastRescheduledAt || null,
        operationVersion: { increment: 1 },
        updatedByUserId: actorUserId,
      },
    });

    const persistedParticipants = await createOrReplaceMeetingParticipants(tx, meetingId, round.organisationId, participants);
    const cancelledReminders = await cancelMeetingRemindersTx(tx, meetingId);
    await onCancelReminderTasks(cancelledReminders);

    for (const participant of persistedParticipants) {
      for (const offsetMinutes of reminderIntervalsMinutes) {
        const scheduledFor = new Date(updatedMeeting.scheduledStartUtc.getTime() - (offsetMinutes * 60 * 1000));
        if (scheduledFor.getTime() <= Date.now()) continue;

        const reminder = await tx.meetingReminder.create({
          data: {
            organisationId: updatedMeeting.organisationId,
            interviewMeetingId: updatedMeeting.id,
            participantId: participant.id,
            reminderType: `${offsetMinutes}_MINUTES`,
            scheduledFor,
          },
        });

        const taskId = await onCreateReminderTask({
          reminder,
          meeting: updatedMeeting,
          participant,
          offsetMinutes,
          actorUserId,
        });

        await tx.meetingReminder.update({
          where: { id: reminder.id },
          data: { backgroundTaskId: taskId },
        });
      }
    }

    await tx.interviewRound.update({
      where: { id: round.id },
      data: {
        status: 'SCHEDULED',
        durationMinutes: meetingInput.durationMinutes,
        timezone: meetingInput.timezone,
        meetingMode: meetingInput.mode,
        scheduledStartAt: meetingInput.scheduledStartUtc,
        scheduledEndAt: meetingInput.scheduledEndUtc,
        meetingLocation: meetingInput.location,
        meetingLink: providerResult.safeJoinUrl || meetingInput.safeJoinUrl || null,
        officeAddress: meetingInput.officeAddress,
        candidateInstructions: meetingInput.candidateInstructions,
        instructions: meetingInput.instructions,
        internalNotes: meetingInput.internalNotes,
        cancelReason: null,
        calendarProvider: meetingInput.provider,
        rescheduleCount: hadPreviousSchedule ? { increment: 1 } : undefined,
        lastRescheduledAt: hadPreviousSchedule ? new Date() : null,
        panelMembers: {
          deleteMany: {},
          create: participants
            .filter((participant) => participant.userId && ['INTERVIEWER', 'LEAD_INTERVIEWER', 'OBSERVER'].includes(participant.participantRole))
            .map((participant) => ({
              organisationId: round.organisationId,
              userId: participant.userId,
              isLead: participant.participantRole === 'LEAD_INTERVIEWER',
              isObserver: participant.participantRole === 'OBSERVER',
              feedbackRequired: participant.required,
            })),
        },
      },
    });

    await tx.application.update({
      where: { id: round.interviewProcess.application.id },
      data: {
        currentStage: 'INTERVIEW_SCHEDULED',
        statusLabel: 'Interview',
        interviewScheduledAt: meetingInput.scheduledStartUtc,
        interviewerName: round.roundName,
      },
    });

    await tx.interviewScheduleHistory.create({
      data: {
        organisationId: round.organisationId,
        interviewMeetingId: meetingId,
        action: historyAction,
        actorUserId,
        oldStartUtc: existingMeeting?.scheduledStartUtc || null,
        oldEndUtc: existingMeeting?.scheduledEndUtc || null,
        newStartUtc: meetingInput.scheduledStartUtc,
        newEndUtc: meetingInput.scheduledEndUtc,
        oldProvider: existingMeeting?.provider || null,
        newProvider: meetingInput.provider,
        oldParticipantSnapshot,
        newParticipantSnapshot,
        reason: meetingInput.internalNotes || null,
        providerOperationId: updatedMeeting.providerOperationKey || null,
        providerResult: {
          externalMeetingId: providerResult.externalMeetingId || null,
          externalCalendarEventId: providerResult.externalCalendarEventId || null,
        },
      },
    });

    return { updatedMeeting, persistedParticipants };
  });
}

export function markMeetingProviderFailure(meetingId, providerError, actorUserId) {
  return prisma.interviewMeeting.update({
    where: { id: meetingId },
    data: {
      status: 'PROVIDER_FAILED',
      providerFailureCode: providerError.code || 'PROVIDER_FAILED',
      providerFailureMessage: providerError.safeMessage || providerError.message,
      updatedByUserId: actorUserId,
    },
  });
}

export function findInterviewMeetingWithScheduleDetails(meetingId) {
  return prisma.interviewMeeting.findUnique({
    where: { id: meetingId },
    include: {
      participants: true,
      scheduleHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
      reminders: true,
      interviewRound: true,
    },
  });
}

export async function cancelInterviewMeetingRecord({
  meeting,
  round,
  organisationId,
  actorUserId,
  cancelReason,
  onCancelReminderTasks,
}) {
  await prisma.$transaction(async (tx) => {
    const cancelledReminders = await cancelMeetingRemindersTx(tx, meeting.id);
    await onCancelReminderTasks(cancelledReminders);
    await tx.interviewMeeting.update({
      where: { id: meeting.id },
      data: {
        status: 'CANCELLED',
        providerCancelledAt: new Date(),
        providerFailureCode: null,
        providerFailureMessage: null,
        updatedByUserId: actorUserId,
      },
    });
    await tx.interviewRound.update({
      where: { id: round.id },
      data: {
        status: 'CANCELLED',
        cancelReason,
      },
    });
    await tx.interviewScheduleHistory.create({
      data: {
        organisationId,
        interviewMeetingId: meeting.id,
        action: 'CANCELLED',
        actorUserId,
        oldStartUtc: meeting.scheduledStartUtc,
        oldEndUtc: meeting.scheduledEndUtc,
        oldProvider: meeting.provider,
        reason: cancelReason,
      },
    });
  });
}

export function findInterviewRoundForCalendarDownload(organisationId, roundId) {
  return prisma.interviewRound.findFirst({
    where: { id: roundId, organisationId },
    include: {
      meeting: { include: { participants: true } },
      interviewProcess: {
        include: {
          application: {
            include: {
              candidate: { include: { user: true } },
              job: true,
            },
          },
        },
      },
    },
  });
}

export function findInterviewRoundForCandidateReschedule(roundId, candidateId) {
  return prisma.interviewRound.findFirst({
    where: {
      id: roundId,
      interviewProcess: {
        application: {
          candidateId,
        },
      },
    },
    include: {
      meeting: true,
      interviewProcess: { include: { application: { include: { job: true } } } },
    },
  });
}

export function findInterviewRoundForOrganisationReschedule(roundId, organisationId) {
  return prisma.interviewRound.findFirst({
    where: { id: roundId, organisationId },
    include: {
      meeting: true,
      interviewProcess: { include: { application: { include: { job: true } } } },
    },
  });
}

export function findPendingInterviewRescheduleRequestForRequester(meetingId, candidateId, userId) {
  return prisma.interviewRescheduleRequest.findFirst({
    where: {
      interviewMeetingId: meetingId,
      status: 'PENDING',
      ...(candidateId ? { candidateId } : { requestedByUserId: userId }),
    },
  });
}

export function createInterviewRescheduleRequestRecord({
  organisationId,
  meetingId,
  requesterType,
  requestedByUserId,
  candidateId,
  reasonCode,
  reasonText,
  preferredTimezone,
  options,
}) {
  return prisma.interviewRescheduleRequest.create({
    data: {
      organisationId,
      interviewMeetingId: meetingId,
      requestedByType: requesterType,
      requestedByUserId,
      candidateId,
      reasonCode,
      reasonText,
      preferredTimezone,
      options: {
        create: options,
      },
    },
    include: { options: true },
  });
}

export function updateInterviewMeetingStatus(meetingId, data) {
  return prisma.interviewMeeting.update({
    where: { id: meetingId },
    data,
  });
}

export function findPendingInterviewRescheduleRequestByRequester(requestId, candidateId, userId) {
  return prisma.interviewRescheduleRequest.findFirst({
    where: {
      id: requestId,
      status: 'PENDING',
      ...(candidateId ? { candidateId } : { requestedByUserId: userId }),
    },
  });
}

export function updateInterviewRescheduleRequest(requestId, data) {
  return prisma.interviewRescheduleRequest.update({
    where: { id: requestId },
    data,
  });
}

export function findMeetingWithContext(meetingId) {
  return prisma.interviewMeeting.findUnique({
    where: { id: meetingId },
    include: {
      participants: {
        include: {
          user: true,
          candidate: true,
        },
        orderBy: [{ required: 'desc' }, { createdAt: 'asc' }],
      },
      reminders: { orderBy: { scheduledFor: 'asc' } },
      rescheduleRequests: {
        include: {
          options: { orderBy: { priority: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      },
      scheduleHistory: { orderBy: { createdAt: 'desc' }, take: 50 },
      interviewRound: {
        include: {
          panelMembers: { include: { user: true } },
          interviewProcess: {
            include: {
              application: {
                include: {
                  candidate: { include: { user: true } },
                  job: { include: { organisation: true } },
                },
              },
            },
          },
        },
      },
    },
  });
}

export function findOrganisationInterviewMeetings(where) {
  return prisma.interviewMeeting.findMany({
    where,
    include: {
      participants: { include: { user: true, candidate: true } },
      reminders: true,
      rescheduleRequests: {
        include: { options: true },
        orderBy: { createdAt: 'desc' },
      },
      interviewRound: {
        include: {
          interviewProcess: {
            include: {
              application: {
                include: {
                  candidate: { include: { user: true } },
                  job: { include: { organisation: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ scheduledStartUtc: 'asc' }, { createdAt: 'desc' }],
  });
}

export function findOrganisationRoundMeetingReference(roundId, organisationId) {
  return prisma.interviewRound.findFirst({
    where: {
      id: roundId,
      organisationId,
    },
    select: { meeting: { select: { id: true } } },
  });
}

export function findInterviewerAssignedMeetings(organisationId, actorUserId) {
  return prisma.interviewMeeting.findMany({
    where: {
      organisationId,
      participants: {
        some: {
          userId: actorUserId,
          participantRole: { in: ['INTERVIEWER', 'LEAD_INTERVIEWER', 'HIRING_MANAGER', 'COORDINATOR', 'OBSERVER', 'RECRUITER'] },
        },
      },
    },
    include: {
      participants: { include: { user: true, candidate: true } },
      interviewRound: {
        include: {
          interviewProcess: {
            include: {
              application: {
                include: {
                  candidate: { include: { user: true } },
                  job: { include: { organisation: true } },
                },
              },
            },
          },
        },
      },
      rescheduleRequests: { include: { options: true }, orderBy: { createdAt: 'desc' } },
    },
    orderBy: [{ scheduledStartUtc: 'asc' }, { createdAt: 'desc' }],
  });
}

export function findCandidateRoundForCalendar(roundId, candidateId) {
  return prisma.interviewRound.findFirst({
    where: {
      id: roundId,
      interviewProcess: {
        application: {
          candidateId,
        },
      },
    },
    include: {
      meeting: { include: { participants: true } },
      interviewProcess: {
        include: {
          application: {
            include: {
              job: true,
            },
          },
        },
      },
    },
  });
}

export function findInterviewRescheduleRequestForReview(requestId, organisationId) {
  return prisma.interviewRescheduleRequest.findFirst({
    where: {
      id: requestId,
      organisationId,
      status: 'PENDING',
    },
    include: {
      options: { orderBy: { priority: 'asc' } },
      meeting: {
        include: {
          participants: true,
          interviewRound: {
            include: {
              interviewProcess: {
                include: {
                  application: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function rejectInterviewRescheduleRequestRecord(request, actorUserId, decisionReason) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.interviewRescheduleRequest.update({
      where: { id: request.id },
      data: {
        status: 'REJECTED',
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
        decisionReason,
      },
    });

    const remainingPending = await tx.interviewRescheduleRequest.count({
      where: {
        interviewMeetingId: request.interviewMeetingId,
        status: 'PENDING',
        id: { not: request.id },
      },
    });

    if (remainingPending === 0) {
      await tx.interviewMeeting.update({
        where: { id: request.interviewMeetingId },
        data: { status: 'SCHEDULED', updatedByUserId: actorUserId },
      });
    }

    return result;
  });
}

export function markInterviewRescheduleRequestApproved(requestId, actorUserId, decisionReason) {
  return prisma.interviewRescheduleRequest.update({
    where: { id: requestId },
    data: {
      status: 'APPROVED',
      reviewedByUserId: actorUserId,
      reviewedAt: new Date(),
      decisionReason,
    },
  });
}

export function findInterviewRescheduleRequestWithOptions(requestId) {
  return prisma.interviewRescheduleRequest.findUnique({
    where: { id: requestId },
    include: { options: { orderBy: { priority: 'asc' } } },
  });
}
