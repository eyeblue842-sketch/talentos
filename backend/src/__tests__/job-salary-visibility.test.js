import test from 'node:test';
import assert from 'node:assert/strict';
import {
  serializeJob,
  serializePublicJob,
  serializeApplication,
  serializeSavedJob,
  assertPublicJobProjectionContract,
  collectPublicJobProjectionPrivacyViolations,
} from '../serializers/index.js';

function makeJob(overrides = {}) {
  return {
    id: 'job-1',
    slug: 'senior-java-developer',
    title: 'Senior Java Developer',
    description: 'Build things.',
    location: 'Bengaluru',
    employmentType: 'FULL_TIME',
    workplaceType: 'HYBRID',
    experienceMin: 5,
    experienceMax: 8,
    salaryMin: 2500000,
    salaryMax: 3500000,
    currency: 'INR',
    publicSalaryEnabled: true,
    numberOfOpenings: 1,
    skillsRequired: [],
    responsibilities: [],
    requirements: [],
    benefits: [],
    visibility: 'EXTERNAL',
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
    organisation: null,
    ...overrides,
  };
}

test('serializeJob (internal/recruiter) always returns the real salary regardless of publicSalaryEnabled', () => {
  const hidden = serializeJob(makeJob({ publicSalaryEnabled: false }));
  assert.equal(hidden.salaryMin, 2500000);
  assert.equal(hidden.salaryMax, 3500000);
  assert.equal(hidden.publicSalaryEnabled, false);
});

test('serializePublicJob exposes salary and salaryVisible:true when publicSalaryEnabled is true', () => {
  const result = serializePublicJob(makeJob({ publicSalaryEnabled: true }));
  assert.equal(result.salaryVisible, true);
  assert.equal(result.salaryMin, 2500000);
  assert.equal(result.salaryMax, 3500000);
  assert.equal(result.currency, 'INR');
});

test('serializePublicJob allows legitimate public benefits without treating them as AI metadata', () => {
  const result = serializePublicJob(makeJob({
    benefits: ['Health insurance', 'Learning stipend'],
  }));

  assert.deepEqual(result.benefits, ['Health insurance', 'Learning stipend']);
  assert.deepEqual(collectPublicJobProjectionPrivacyViolations(result), []);
});

test('serializePublicJob nulls salary and reports salaryVisible:false when publicSalaryEnabled is false', () => {
  const result = serializePublicJob(makeJob({ publicSalaryEnabled: false }));
  assert.equal(result.salaryVisible, false);
  assert.equal(result.salaryMin, null);
  assert.equal(result.salaryMax, null);
  assert.equal(result.currency, null);
});

test('serializePublicJob never exposes internal JD review metadata or unaccepted screening suggestions', () => {
  const result = serializePublicJob(makeJob({
    assumptions: ['Internal assumption'],
    missingFields: ['Internal missing field'],
    exclusionaryWordingWarnings: ['Internal warning'],
    interviewFocus: ['Internal interview focus'],
    screeningQuestions: [{
      id: 'suggested-question-1',
      questionText: 'AI suggested but not accepted',
      required: true,
    }],
    preferredCandidateProfile: {
      additionalNotes: 'Internal missing-field note',
    },
  }));

  assert.equal('assumptions' in result, false);
  assert.equal('missingFields' in result, false);
  assert.equal('exclusionaryWordingWarnings' in result, false);
  assert.equal('interviewFocus' in result, false);
  assert.equal('screeningQuestions' in result, false);
  assert.equal('preferredCandidateProfile' in result, false);
  assert.equal(JSON.stringify(result).includes('Internal'), false);
  assert.equal(JSON.stringify(result).includes('AI suggested'), false);
});

test('public job privacy contract blocks exact private fields recursively without broad keyword matching', () => {
  const safe = serializePublicJob(makeJob({
    benefits: ['Benefits are candidate-facing public content.'],
    organisation: {
      id: 'org-1',
      name: 'Northstar Talent Labs',
      slug: 'northstar-talent-labs',
      benefitsSummary: 'Public company benefits overview.',
    },
  }));

  assert.deepEqual(collectPublicJobProjectionPrivacyViolations(safe), []);
  assert.throws(
    () => assertPublicJobProjectionContract({
      ...safe,
      organisation: {
        ...safe.organisation,
        assumptions: ['Nested private field must not leak.'],
      },
    }),
    (error) => error.code === 'PUBLIC_JOB_PROJECTION_PRIVACY_VIOLATION'
      && error.violations.some((item) => item.path === 'organisation.assumptions' && item.reason === 'private_field'),
  );
  assert.throws(
    () => assertPublicJobProjectionContract({
      ...safe,
      providerMetadata: { requestId: 'internal-provider-id' },
    }),
    (error) => error.code === 'PUBLIC_JOB_PROJECTION_PRIVACY_VIOLATION'
      && error.violations.some((item) => item.path === 'providerMetadata' && item.reason === 'private_field'),
  );
});

test('public job privacy contract rejects unaccepted AI suggestions and internal source identifiers', () => {
  const safe = serializePublicJob(makeJob());

  assert.throws(
    () => assertPublicJobProjectionContract({
      ...safe,
      sourceResultId: 'cmresultinternal123',
      screeningQuestionSuggestions: ['Unaccepted AI question'],
      skillSuggestions: ['Unaccepted AI skill'],
    }),
    (error) => error.code === 'PUBLIC_JOB_PROJECTION_PRIVACY_VIOLATION'
      && error.violations.some((item) => item.path === 'sourceResultId')
      && error.violations.some((item) => item.path === 'screeningQuestionSuggestions')
      && error.violations.some((item) => item.path === 'skillSuggestions'),
  );
});

test('serializeApplication defaults to the internal job serializer (recruiter/ATS callers)', () => {
  const application = { id: 'app-1', job: makeJob({ publicSalaryEnabled: false }) };
  const result = serializeApplication(application);
  assert.equal(result.job.salaryMin, 2500000, 'recruiter-facing application view must see the real salary');
});

test('serializeApplication with publicJob:true hides salary for candidate-facing callers', () => {
  const application = { id: 'app-1', job: makeJob({ publicSalaryEnabled: false }) };
  const result = serializeApplication(application, { publicJob: true });
  assert.equal(result.job.salaryMin, null);
  assert.equal(result.job.salaryVisible, false);
});

test('serializeSavedJob (candidate saved jobs) never leaks a hidden salary', () => {
  const savedJob = {
    id: 'saved-1',
    createdAt: new Date('2026-08-01'),
    job: makeJob({ publicSalaryEnabled: false, status: 'OPEN' }),
    jobSlugSnapshot: 'senior-java-developer',
    jobTitleSnapshot: 'Senior Java Developer',
    organisationNameSnapshot: 'Careeriz Hire',
  };
  const result = serializeSavedJob(savedJob);
  assert.equal(result.job.salaryMin, null);
  assert.equal(result.job.salaryVisible, false);
});
