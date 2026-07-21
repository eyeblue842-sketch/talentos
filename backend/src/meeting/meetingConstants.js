export const meetingProviders = ['GOOGLE_MEET', 'ZOOM', 'CUSTOM'];

export const providerConnectionStatuses = ['DISCONNECTED', 'CONNECTED', 'EXPIRED', 'ERROR'];

export const interviewMeetingStatuses = [
  'DRAFT',
  'SCHEDULING',
  'SCHEDULED',
  'RESCHEDULE_REQUESTED',
  'RESCHEDULING',
  'CANCELLED',
  'COMPLETED',
  'NO_SHOW',
  'PROVIDER_FAILED',
  'PARTIALLY_FAILED',
  'EXPIRED',
];

export const meetingParticipantRoles = [
  'CANDIDATE',
  'INTERVIEWER',
  'LEAD_INTERVIEWER',
  'HIRING_MANAGER',
  'RECRUITER',
  'COORDINATOR',
  'OBSERVER',
];

export const meetingReminderWindows = [
  { type: '24_HOURS', offsetMinutes: 24 * 60 },
  { type: '1_HOUR', offsetMinutes: 60 },
  { type: '15_MINUTES', offsetMinutes: 15 },
];

export const rescheduleReasonCodes = [
  'MEDICAL_EMERGENCY',
  'PERSONAL_EMERGENCY',
  'SCHEDULE_CONFLICT',
  'TECHNICAL_ISSUE',
  'TRAVEL',
  'INTERVIEWER_UNAVAILABLE',
  'OTHER',
];

export const interviewReadableRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'];
export const interviewWritableRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'];
export const interviewParticipantRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER'];

export const providerStateTtlMinutes = 10;
