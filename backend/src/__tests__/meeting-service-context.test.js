import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let prisma;
let getOrganisationInterviewMeeting;

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ getOrganisationInterviewMeeting } = await import('../meeting/meetingService.js'));
});

const ORG_ID = 'org-meeting-context-1';
const ROUND_ID = 'round-meeting-context-1';
const MEETING_ID = 'meeting-context-1';

beforeEach(() => {
  prisma.organisation.findFirst = async ({ where } = {}) => {
    if (where?.id && where.id !== ORG_ID) return null;
    return { id: ORG_ID, status: 'ACTIVE' };
  };

  prisma.interviewRound.findFirst = async ({ where } = {}) => {
    if (where?.id !== ROUND_ID || where?.organisationId !== ORG_ID) return null;
    return { meeting: { id: MEETING_ID } };
  };

  prisma.interviewMeeting.findUnique = async ({ where } = {}) => {
    if (where?.id !== MEETING_ID) return null;
    return {
      id: MEETING_ID,
      organisationId: ORG_ID,
      status: 'SCHEDULED',
      participants: [],
      reminders: [],
      rescheduleRequests: [],
    };
  };
});

test('getOrganisationInterviewMeeting resolves the meeting via findMeetingWithContext instead of throwing on the undefined getMeetingWithContext reference', async () => {
  const actorUser = { id: 'admin-1', role: 'ADMIN' };

  const result = await getOrganisationInterviewMeeting(actorUser, ROUND_ID, ORG_ID);

  assert.equal(result.id, MEETING_ID);
  assert.equal(result.status, 'SCHEDULED');
  assert.deepEqual(result.participants, []);
});

test('getOrganisationInterviewMeeting still surfaces a 404 when the round has no meeting reference', async () => {
  const actorUser = { id: 'admin-1', role: 'ADMIN' };

  await assert.rejects(
    () => getOrganisationInterviewMeeting(actorUser, 'round-does-not-exist', ORG_ID),
    (error) => {
      assert.equal(error.statusCode, 404);
      return true;
    },
  );
});
