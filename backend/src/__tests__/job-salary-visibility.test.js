import test from 'node:test';
import assert from 'node:assert/strict';
import {
  serializeJob,
  serializePublicJob,
  serializeApplication,
  serializeSavedJob,
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

test('serializePublicJob nulls salary and reports salaryVisible:false when publicSalaryEnabled is false', () => {
  const result = serializePublicJob(makeJob({ publicSalaryEnabled: false }));
  assert.equal(result.salaryVisible, false);
  assert.equal(result.salaryMin, null);
  assert.equal(result.salaryMax, null);
  assert.equal(result.currency, null);
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
