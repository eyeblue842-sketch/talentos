import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeStructuredOutput } from '../intelligence/services/intelligenceRuntimeService.js';
import {
  JobDescriptionValidationError,
  normalizeJobDescriptionOutput,
} from '../intelligence/services/jobDescriptionOutputNormalizer.js';

function validOutput(overrides = {}) {
  return {
    openingSummary: 'Join a finance transformation team as an Anaplan Developer.',
    roleOverview: 'This Anaplan Developer role builds connected planning models for finance transformation teams. The developer will translate business requirements into maintainable Anaplan modules, integrations, and dashboards.',
    keyResponsibilities: [
      'Build and maintain Anaplan modules, lists, dashboards, imports, and exports.',
      'Partner with finance stakeholders to translate planning requirements into model design.',
      'Troubleshoot model performance, access, data integration, and release issues.',
    ],
    requiredQualifications: ['Anaplan model building', 'Finance planning', 'Data imports and exports'],
    preferredQualifications: ['Anaplan certification'],
    additionalSections: [],
    screeningQuestions: [],
    assumptions: [],
    exclusionaryWordingWarnings: [],
    missingFields: [],
    interviewFocus: ['Validate practical Anaplan model-building depth.'],
    ...overrides,
  };
}

test('job description contract accepts valid canonical output', () => {
  const result = normalizeJobDescriptionOutput(validOutput());

  assert.equal(result.output.keyResponsibilities.length, 3);
  assert.equal(result.output.requiredQualifications.length, 3);
  assert.deepEqual(result.output.screeningQuestions, []);
  assert.deepEqual(result.diagnostics, []);
});

test('job description contract never emits a closingInvitation field', () => {
  const result = normalizeJobDescriptionOutput(validOutput({ closingInvitation: 'Apply now with your resume.' }));

  assert.equal('closingInvitation' in result.output, false);
  assert.equal(
    result.diagnostics.some((item) => item.path === 'closingInvitation' && item.reason === 'discarded_unsupported_field'),
    true,
  );
});

test('job description contract keeps preferred qualifications optional and empty when unsupported', () => {
  const result = normalizeJobDescriptionOutput(validOutput({ preferredQualifications: [] }));

  assert.deepEqual(result.output.preferredQualifications, []);
  assert.deepEqual(result.diagnostics, []);
});

test('job description contract accepts genuinely supplied additional sections', () => {
  const result = normalizeJobDescriptionOutput(validOutput({
    additionalSections: [{ heading: 'Team & tooling', body: 'You will work within the finance systems team using Anaplan and Oracle.' }],
  }));

  assert.equal(result.output.additionalSections.length, 1);
  assert.equal(result.output.additionalSections[0].heading, 'Team & tooling');
});

test('job description contract drops incomplete additional sections rather than emitting placeholders', () => {
  const result = normalizeJobDescriptionOutput(validOutput({
    additionalSections: [{ heading: 'Team', body: '' }],
  }));

  assert.deepEqual(result.output.additionalSections, []);
});

test('job description contract accepts zero screening questions', () => {
  const result = normalizeJobDescriptionOutput(validOutput({ screeningQuestions: [] }));

  assert.deepEqual(result.output.screeningQuestions, []);
});

test('job description contract allows up to forty optional screening questions', () => {
  const questions = Array.from({ length: 40 }, (_, index) => `Confirm role-specific evidence ${index + 1}?`);
  const result = normalizeJobDescriptionOutput(validOutput({ screeningQuestions: questions }));

  assert.equal(result.output.screeningQuestions.length, 40);
});

test('job description contract keeps opening summary and role overview distinct', () => {
  const result = normalizeJobDescriptionOutput(validOutput({
    openingSummary: 'Build connected planning models for a finance team.',
    roleOverview: 'This Anaplan Developer role supports finance planning teams with model design. The developer will translate requirements into maintainable modules and dashboards.',
  }));

  assert.equal(result.output.openingSummary, 'Build connected planning models for a finance team.');
  assert.notEqual(result.output.openingSummary, result.output.roleOverview);
});

test('job description contract discards extra top-level fields safely', () => {
  const result = normalizeJobDescriptionOutput(validOutput({
    jobId: 'job-1',
    title: 'Anaplan Developer',
    department: 'Finance',
    exclusionaryOrAmbiguousWordingFlags: [],
  }));

  assert.equal(result.output.roleOverview.includes('Anaplan Developer'), true);
  assert.deepEqual(
    result.diagnostics.filter((item) => item.reason === 'discarded_unsupported_field').map((item) => item.path).sort(),
    ['department', 'exclusionaryOrAmbiguousWordingFlags', 'jobId', 'title'],
  );
});

test('job description contract splits overlong key responsibilities at clause boundaries', () => {
  const longResponsibility = [
    'Build Anaplan modules for connected planning and forecasting workflows.',
    'Partner with finance stakeholders to translate requirements into model design.',
    'Troubleshoot integrations, imports, exports, access, and release issues.',
    'Maintain testing and documentation discipline for every release.',
    'Support user acceptance cycles with finance and operations partners.',
    'Improve model performance by reviewing sparsity and calculation design.',
    'Coordinate data integration changes with source-system owners.',
  ].join(' ');

  const result = normalizeJobDescriptionOutput(validOutput({
    keyResponsibilities: [
      longResponsibility,
      'Maintain role-based access and test model changes before release.',
      'Document model changes for recruiter and stakeholder review.',
    ],
  }));

  assert.equal(result.output.keyResponsibilities.every((item) => item.length <= 400), true);
  assert.equal(result.diagnostics.some((item) => item.reason === 'split_overlong_item'), true);
});

test('job description contract rejects unsplittable overlong responsibilities with sanitized counts', () => {
  const unsplittable = 'A'.repeat(401);

  assert.throws(
    () => normalizeJobDescriptionOutput(validOutput({ keyResponsibilities: [unsplittable, 'Second responsibility.', 'Third responsibility.'] })),
    (error) => {
      assert.equal(error instanceof JobDescriptionValidationError, true);
      assert.equal(error.diagnostics[0].path, 'keyResponsibilities.0');
      assert.equal(error.diagnostics[0].receivedLength, 401);
      assert.equal(error.diagnostics[0].maxLength, 400);
      assert.equal('text' in error.diagnostics[0], false);
      return true;
    },
  );
});

test('structured output parser rejects malformed JSON with a controlled error', () => {
  assert.throws(
    () => normalizeStructuredOutput('{"summary":'),
    (error) => {
      assert.equal(error.code, 'INTELLIGENCE_MALFORMED_JSON');
      assert.equal(error.statusCode, 502);
      return true;
    },
  );
});

test('job description contract rejects missing required sections', () => {
  const payload = validOutput();
  delete payload.roleOverview;

  assert.throws(
    () => normalizeJobDescriptionOutput(payload),
    (error) => error.code === 'JOB_DESCRIPTION_SCHEMA_INVALID'
      && error.diagnostics.some((item) => item.path === 'roleOverview'),
  );
});

test('job description contract rejects one-sentence role overview', () => {
  assert.throws(
    () => normalizeJobDescriptionOutput(validOutput({
      roleOverview: 'This Anaplan Developer role builds planning models for finance teams.',
    })),
    (error) => error.code === 'JOB_DESCRIPTION_SCHEMA_INVALID'
      && error.diagnostics.some((item) => item.path === 'roleOverview'),
  );
});

test('job description contract accepts two-to-three-sentence role overview', () => {
  const result = normalizeJobDescriptionOutput(validOutput({
    roleOverview: 'This Anaplan Developer role builds connected planning models for finance teams. The developer will partner with stakeholders to improve forecasting workflows. The role emphasizes accurate model design and maintainable data integrations.',
  }));

  assert.equal(result.output.roleOverview.includes('forecasting workflows'), true);
});

test('job description contract tolerates common abbreviations in role overview sentence validation', () => {
  const result = normalizeJobDescriptionOutput(validOutput({
    roleOverview: 'This Sr. Anaplan Developer role builds planning models for finance teams. The developer will partner with U.S. stakeholders on forecasting workflows.',
  }));

  assert.equal(result.output.roleOverview.includes('Sr.'), true);
});

test('job description contract accepts one or two source-provided required qualifications without forcing invention', () => {
  const result = normalizeJobDescriptionOutput(validOutput({
    requiredQualifications: ['Anaplan model building', 'Finance planning'],
    missingFields: ['Recruiter provided fewer than three required skills; confirm whether any additional skills are required.'],
  }));

  assert.deepEqual(result.output.requiredQualifications, ['Anaplan model building', 'Finance planning']);
});

test('job description contract rejects empty, blank, and Any qualifications', () => {
  assert.throws(
    () => normalizeJobDescriptionOutput(validOutput({
      requiredQualifications: ['Anaplan model building', '   ', 'Finance planning'],
    })),
    (error) => error.code === 'JOB_DESCRIPTION_SCHEMA_INVALID'
      && error.diagnostics.some((item) => item.path === 'requiredQualifications.1' && item.reason === 'item_blank'),
  );

  assert.throws(
    () => normalizeJobDescriptionOutput(validOutput({
      requiredQualifications: ['Anaplan model building', 'Any,', 'Finance planning'],
    })),
    (error) => error.code === 'JOB_DESCRIPTION_SCHEMA_INVALID'
      && error.diagnostics.some((item) => item.path === 'requiredQualifications.1'),
  );
});
