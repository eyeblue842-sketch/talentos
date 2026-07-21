import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInterviewCalendarFile } from '../meeting/calendarService.js';
import { getMeetingProvider } from '../meeting/providers/meetingProviderFactory.js';
import {
  assertFutureSchedule,
  assertValidTimezone,
  ensureHttpsUrl,
  normalizeProviderError,
} from '../meeting/meetingValidation.js';

test('meeting provider factory returns supported providers and rejects unknown providers', async () => {
  const customProvider = getMeetingProvider('CUSTOM');
  const meeting = await customProvider.createMeeting({
    meetingInput: {
      meetingMode: 'VIRTUAL',
      meetingLink: 'https://meet.example.com/round-1',
      providerDisplayName: 'External room',
      dialInInformation: 'Dial +91 80 1111 1111',
      passcode: '123456',
    },
  });

  assert.equal(meeting.provider, 'CUSTOM');
  assert.equal(meeting.safeJoinUrl, 'https://meet.example.com/round-1');
  assert.deepEqual(meeting.passcodeMetadata, { passcodeSet: true });
  assert.throws(() => getMeetingProvider('MICROSOFT_TEAMS'), /Unsupported meeting provider/i);
});

test('meeting validation enforces safe URLs, timezones, duration limits, and provider normalization', () => {
  assert.equal(ensureHttpsUrl('https://zoom.us/j/123'), 'https://zoom.us/j/123');
  assert.throws(() => ensureHttpsUrl('javascript:alert(1)'), /Unsafe URL scheme/i);
  assert.throws(() => ensureHttpsUrl('http://zoom.us/j/123'), /Only HTTPS meeting URLs are allowed/i);

  assert.doesNotThrow(() => assertValidTimezone('Asia/Kolkata'));
  assert.throws(() => assertValidTimezone('Mars/Phobos'), /Invalid timezone/i);

  const start = new Date('2030-07-21T10:00:00.000Z');
  const end = new Date('2030-07-21T11:00:00.000Z');
  assert.equal(assertFutureSchedule(start, end), 60);
  assert.throws(() => assertFutureSchedule(start, start), /end time must be after the start time/i);

  const normalized = normalizeProviderError({ message: 'Token expired', statusCode: 401, code: 'TOKEN_EXPIRED' }, 'GOOGLE_MEET');
  assert.equal(normalized.statusCode, 401);
  assert.equal(normalized.code, 'TOKEN_EXPIRED');
  assert.match(normalized.message, /GOOGLE_MEET scheduling failed/i);
});

test('calendar service generates standards-compatible request and cancellation ICS output', () => {
  const requestIcs = buildInterviewCalendarFile({
    uid: 'careeriz-round-1',
    method: 'REQUEST',
    sequence: 2,
    summary: 'Technical Interview',
    description: 'Join using the secure meeting link.',
    location: 'Google Meet',
    startUtc: '2030-07-21T10:00:00.000Z',
    endUtc: '2030-07-21T11:00:00.000Z',
    organizer: { name: 'Careeriz Recruiter', email: 'recruiter@careeriz.test' },
    attendees: [
      { name: 'Candidate', email: 'candidate@test.com' },
      { name: 'Interviewer', email: 'panel@test.com', role: 'OPT-PARTICIPANT', partstat: 'ACCEPTED' },
    ],
    url: 'https://meet.google.com/abc-defg-hij',
  });

  const cancelIcs = buildInterviewCalendarFile({
    uid: 'careeriz-round-1',
    method: 'CANCEL',
    sequence: 3,
    summary: 'Technical Interview',
    description: 'Interview cancelled.',
    location: 'Google Meet',
    startUtc: '2030-07-21T10:00:00.000Z',
    endUtc: '2030-07-21T11:00:00.000Z',
    status: 'CANCELLED',
  });

  assert.match(requestIcs, /BEGIN:VCALENDAR/);
  assert.match(requestIcs, /METHOD:REQUEST/);
  assert.match(requestIcs, /ATTENDEE;CN=Candidate/);
  assert.ok(requestIcs.includes('URL:https://meet.google.com/abc-defg-hij'));
  assert.match(cancelIcs, /METHOD:CANCEL/);
  assert.match(cancelIcs, /STATUS:CANCELLED/);
});
