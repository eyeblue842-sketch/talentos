import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveProvider,
  buildPromptVariables,
  serializeScreeningCall,
} from '../services/aiRecruiter/screeningPlan.js';
import { mapProviderEvent } from '../services/aiRecruiter/screeningResultMapper.js';

// Pure-logic tests for the AI voice recruiter: no DB, no env, no I/O.

test('resolveProvider routes +91 to Plivo and everyone else to Vapi', () => {
  assert.equal(resolveProvider('+919061190007'), 'PLIVO');
  assert.equal(resolveProvider('919061190007'), 'PLIVO');
  assert.equal(resolveProvider('+1 (910) 708-6027'), 'VAPI');
  assert.equal(resolveProvider('+447911123456'), 'VAPI');
  assert.equal(resolveProvider(''), 'VAPI');
});

test('buildPromptVariables derives from the job and honours overrides', () => {
  const job = {
    title: 'Backend Engineer',
    location: 'Bangalore',
    workplaceType: 'HYBRID',
    description: 'Build and scale APIs.',
    skillsRequired: ['Node.js', 'PostgreSQL', 'AWS'],
    department: 'Engineering',
  };
  const candidate = { fullName: 'Asha Rao' };

  const v = buildPromptVariables({ job, candidate, overrides: {} });
  assert.equal(v.candidateName, 'Asha Rao');
  assert.equal(v.jobTitle, 'Backend Engineer');
  assert.equal(v.jobLocation, 'Bangalore');
  assert.equal(v.jobMode, 'HYBRID');
  assert.equal(v.screeningQuestions.length, 3);
  assert.match(v.screeningQuestions[0], /Node\.js/);
  assert.match(v.clientCompanyBrief, /Engineering/);
  assert.equal(v.screeningQuestionsText, v.screeningQuestions.join(' | '));

  const o = buildPromptVariables({
    job,
    candidate,
    overrides: {
      jobTitle: 'Staff Engineer',
      clientCompanyBrief: 'an IT services company based in Bangalore with offices in Chennai and Trichy',
      screeningQuestions: ['Tell me about your REST API experience.'],
    },
  });
  assert.equal(o.jobTitle, 'Staff Engineer');
  assert.match(o.clientCompanyBrief, /Chennai and Trichy/);
  assert.deepEqual(o.screeningQuestions, ['Tell me about your REST API experience.']);
});

test('buildPromptVariables falls back cleanly when the job is sparse', () => {
  const v = buildPromptVariables({ job: {}, candidate: {}, overrides: {} });
  assert.equal(v.candidateName, 'there');
  assert.equal(v.jobTitle, 'the role');
  assert.equal(v.jobMode, 'not specified');
  assert.ok(v.screeningQuestions.length >= 1);
  assert.equal(v.clientCompanyBrief, 'one of our client companies');
});

test('mapProviderEvent maps a Vapi end-of-call report into our fields', () => {
  const payload = {
    message: {
      type: 'end-of-call-report',
      call: { id: 'call_abc', metadata: { screeningCallId: 'sc_1' } },
      endedReason: 'customer-ended-call',
      durationSeconds: 182,
      artifact: { recordingUrl: 'https://rec/abc.mp3', transcript: 'Hello, this is Aria...' },
      analysis: {
        summary: 'Interested candidate, 60 day notice.',
        structuredData: {
          currentCtc: '12 LPA',
          expectedCtc: '18 LPA',
          noticePeriod: '60 days',
          negotiable: 'yes',
          buyout: 'no',
          earliest_join_date: '45 days',
          outcome: 'interested',
        },
      },
    },
  };
  const m = mapProviderEvent('VAPI', payload);
  assert.equal(m.providerCallId, 'call_abc');
  assert.equal(m.screeningCallId, 'sc_1');
  assert.equal(m.status, 'COMPLETED');
  assert.equal(m.durationSeconds, 182);
  assert.equal(m.recordingUrl, 'https://rec/abc.mp3');
  assert.equal(m.currentCtc, '12 LPA');
  assert.equal(m.expectedCtc, '18 LPA');
  assert.equal(m.noticePeriod, '60 days');
  assert.equal(m.noticeNegotiable, true);
  assert.equal(m.buyoutAvailable, false);
  assert.equal(m.earliestJoinDate, '45 days');
  assert.equal(m.outcome, 'INTERESTED');
  assert.equal(m.aiSummary, 'Interested candidate, 60 day notice.');
});

test('mapProviderEvent maps a Vapi status update', () => {
  const m = mapProviderEvent('VAPI', { message: { type: 'status-update', status: 'in-progress', call: { id: 'c1' } } });
  assert.equal(m.status, 'IN_PROGRESS');
  assert.equal(m.providerCallId, 'c1');
});

test('mapProviderEvent maps a Plivo event with extracted values', () => {
  const payload = {
    call_uuid: 'plivo-123',
    metadata: { screeningCallId: 'sc_2' },
    call_status: 'completed',
    hangup_cause: 'NORMAL_CLEARING',
    recording_url: 'https://rec/p.mp3',
    duration: '120',
    extracted: {
      current_ctc: '8 LPA',
      expected_ctc: '12 LPA',
      notice_period: '30 days',
      notice_negotiable: 'true',
      buyout_available: 'false',
      availability: 'immediate',
      result: 'not_interested',
    },
  };
  const m = mapProviderEvent('PLIVO', payload);
  assert.equal(m.providerCallId, 'plivo-123');
  assert.equal(m.screeningCallId, 'sc_2');
  assert.equal(m.status, 'COMPLETED');
  assert.equal(m.currentCtc, '8 LPA');
  assert.equal(m.noticeNegotiable, true);
  assert.equal(m.buyoutAvailable, false);
  assert.equal(m.earliestJoinDate, 'immediate');
  assert.equal(m.outcome, 'NOT_INTERESTED');
});

test('mapProviderEvent is defensive on garbage input', () => {
  assert.doesNotThrow(() => mapProviderEvent('VAPI', null));
  assert.equal(typeof mapProviderEvent('VAPI', null), 'object');
  assert.deepEqual(mapProviderEvent('UNKNOWN', {}), {});
});

test('serializeScreeningCall shapes the record for the API', () => {
  const out = serializeScreeningCall({
    id: 'sc_1', applicationId: 'app_1', jobId: 'job_1', candidateId: 'cand_1',
    provider: 'PLIVO', status: 'DRY_RUN', outcome: 'PENDING', dryRun: true,
    toPhoneNumber: '+919061190007', callerId: '+918065495503', consentCaptured: true,
    currentCtc: '8 LPA', noticeNegotiable: true,
  });
  assert.equal(out.id, 'sc_1');
  assert.equal(out.provider, 'PLIVO');
  assert.equal(out.dryRun, true);
  assert.equal(out.results.currentCtc, '8 LPA');
  assert.equal(out.results.noticeNegotiable, true);
  assert.equal(serializeScreeningCall(null), null);
});
