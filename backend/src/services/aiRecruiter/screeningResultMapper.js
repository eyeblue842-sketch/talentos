// Normalizes a raw provider webhook payload into the subset of ScreeningCall
// fields it carries. Everything is best-effort and defensive: webhook schemas
// differ between Vapi and Plivo and evolve, so unknown shapes simply yield
// fewer fields (never throw), and the caller always keeps the raw payload in
// `lastProviderEvent`. Returns an object; only present keys are applied.

const STATUS_MAP = {
  queued: 'QUEUED',
  ringing: 'RINGING',
  'in-progress': 'IN_PROGRESS',
  in_progress: 'IN_PROGRESS',
  ongoing: 'IN_PROGRESS',
  answered: 'IN_PROGRESS',
  forwarding: 'IN_PROGRESS',
  ended: 'COMPLETED',
  completed: 'COMPLETED',
  'no-answer': 'NO_ANSWER',
  no_answer: 'NO_ANSWER',
  noanswer: 'NO_ANSWER',
  busy: 'BUSY',
  failed: 'FAILED',
  error: 'FAILED',
  canceled: 'CANCELLED',
  cancelled: 'CANCELLED',
};

const OUTCOME_MAP = {
  interested: 'INTERESTED',
  not_interested: 'NOT_INTERESTED',
  'not-interested': 'NOT_INTERESTED',
  declined: 'NOT_INTERESTED',
  callback: 'CALLBACK_REQUESTED',
  callback_requested: 'CALLBACK_REQUESTED',
  do_not_contact: 'DO_NOT_CONTACT',
  'do-not-contact': 'DO_NOT_CONTACT',
  dnc: 'DO_NOT_CONTACT',
  unreachable: 'UNREACHABLE',
  voicemail: 'UNREACHABLE',
  incomplete: 'INCOMPLETE',
};

function normalizeStatus(value) {
  if (!value) return undefined;
  return STATUS_MAP[String(value).toLowerCase().trim()] || undefined;
}

function normalizeOutcome(value) {
  if (!value) return undefined;
  return OUTCOME_MAP[String(value).toLowerCase().trim()] || undefined;
}

function toBool(value) {
  if (value === true || value === false) return value;
  if (value === null || value === undefined) return undefined;
  const s = String(value).toLowerCase().trim();
  if (['true', 'yes', 'y', '1', 'available', 'negotiable'].includes(s)) return true;
  if (['false', 'no', 'n', '0', 'not available', 'non-negotiable', 'not negotiable'].includes(s)) return false;
  return undefined;
}

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

function toDate(value) {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// Map a bag of structured key/values (however the agent labelled them) onto our
// result fields. Accepts several common key spellings.
function mapStructured(structured = {}) {
  if (!structured || typeof structured !== 'object') return {};
  const g = (...keys) => {
    for (const k of keys) {
      if (structured[k] !== undefined && structured[k] !== null && structured[k] !== '') return structured[k];
    }
    return undefined;
  };
  const out = {};
  const currentCtc = g('currentCtc', 'current_ctc', 'currentCTC', 'current_salary', 'currentSalary');
  const expectedCtc = g('expectedCtc', 'expected_ctc', 'expectedCTC', 'expected_salary', 'expectedSalary');
  const noticePeriod = g('noticePeriod', 'notice_period', 'notice');
  const noticeNegotiable = toBool(g('noticeNegotiable', 'notice_negotiable', 'negotiable'));
  const buyoutAvailable = toBool(g('buyoutAvailable', 'buyout_available', 'buyout'));
  const earliestJoinDate = g('earliestJoinDate', 'earliest_join_date', 'joinDate', 'join_date', 'availability');
  const techAnswers = g('techAnswers', 'tech_answers', 'technicalAnswers', 'technical_answers', 'answers');
  const interestSummary = g('interestSummary', 'interest', 'interested');
  const outcome = normalizeOutcome(g('outcome', 'result', 'disposition'));

  if (currentCtc !== undefined) out.currentCtc = String(currentCtc);
  if (expectedCtc !== undefined) out.expectedCtc = String(expectedCtc);
  if (noticePeriod !== undefined) out.noticePeriod = String(noticePeriod);
  if (noticeNegotiable !== undefined) out.noticeNegotiable = noticeNegotiable;
  if (buyoutAvailable !== undefined) out.buyoutAvailable = buyoutAvailable;
  if (earliestJoinDate !== undefined) out.earliestJoinDate = String(earliestJoinDate);
  if (techAnswers !== undefined) out.techAnswers = techAnswers;
  if (interestSummary !== undefined) out.interestSummary = String(interestSummary);
  if (outcome !== undefined) out.outcome = outcome;
  return out;
}

function mapVapi(payload) {
  // Vapi wraps server events in { message: {...} }.
  const m = payload?.message || payload || {};
  const call = m.call || payload?.call || {};
  const artifact = m.artifact || {};
  const analysis = m.analysis || {};
  const out = {
    providerCallId: call.id || m.callId || undefined,
    screeningCallId: call.metadata?.screeningCallId || m.metadata?.screeningCallId || payload?.metadata?.screeningCallId || undefined,
  };
  const status = normalizeStatus(m.status || call.status);
  if (status) out.status = status;
  if (m.endedReason) out.endedReason = String(m.endedReason);
  const recordingUrl = m.recordingUrl || artifact.recordingUrl;
  if (recordingUrl) out.recordingUrl = recordingUrl;
  const transcript = artifact.transcript || m.transcript;
  if (transcript) out.transcript = typeof transcript === 'string' ? transcript : JSON.stringify(transcript);
  const duration = toInt(m.durationSeconds ?? m.duration);
  if (duration !== undefined) out.durationSeconds = duration;
  const answeredAt = toDate(m.startedAt || call.startedAt);
  if (answeredAt) out.answeredAt = answeredAt;
  const endedAt = toDate(m.endedAt || call.endedAt);
  if (endedAt) out.endedAt = endedAt;
  if (analysis.summary) out.aiSummary = String(analysis.summary);
  Object.assign(out, mapStructured(analysis.structuredData));
  // An end-of-call report with no explicit status is a completed call.
  if (!out.status && (m.type === 'end-of-call-report' || m.type === 'end-of-call')) out.status = 'COMPLETED';
  return out;
}

function mapPlivo(payload) {
  const p = payload || {};
  const out = {
    providerCallId: p.call_uuid || p.callUuid || p.request_uuid || p.id || p.run_id || undefined,
    screeningCallId: p.metadata?.screeningCallId || p.screeningCallId || undefined,
  };
  const status = normalizeStatus(p.call_status || p.status || p.event);
  if (status) out.status = status;
  if (p.hangup_cause || p.endedReason) out.endedReason = String(p.hangup_cause || p.endedReason);
  const recordingUrl = p.recording_url || p.recordingUrl;
  if (recordingUrl) out.recordingUrl = recordingUrl;
  const transcript = p.transcript || p.transcription;
  if (transcript) out.transcript = typeof transcript === 'string' ? transcript : JSON.stringify(transcript);
  const duration = toInt(p.duration || p.call_duration || p.billed_duration);
  if (duration !== undefined) out.durationSeconds = duration;
  const endedAt = toDate(p.end_time || p.endedAt);
  if (endedAt) out.endedAt = endedAt;
  if (p.summary) out.aiSummary = String(p.summary);
  // Plivo agents surface extracted values under a few possible keys.
  Object.assign(out, mapStructured(p.extracted || p.variables || p.collected || p.data || p.structuredData));
  return out;
}

export function mapProviderEvent(providerKey, payload) {
  try {
    if (providerKey === 'VAPI') return mapVapi(payload);
    if (providerKey === 'PLIVO') return mapPlivo(payload);
  } catch {
    // Never let a malformed payload break ingestion.
  }
  return {};
}
