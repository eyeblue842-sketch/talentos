import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDeterministicCandidateMatch } from '../intelligence/services/deterministicMatchService.js';
import { buildDeterministicQueryParse } from '../intelligence/services/talentSearchService.js';
import { validateProviderBaseUrl } from '../intelligence/providers/providerUtils.js';
import {
  candidateMatchExplanationOutputSchema,
  talentSearchParseOutputSchema,
} from '../intelligence/schemas/outputSchemas.js';

test('deterministic candidate match is explainable and excludes protected-attribute concepts', () => {
  const result = calculateDeterministicCandidateMatch(
    {
      skills: ['Java', 'AWS', 'Kafka'],
      totalExperience: 8,
      location: 'Bangalore',
      currentTitle: 'Senior Java Developer',
      workplacePreferences: ['HYBRID'],
      employmentPreferences: ['FULL_TIME'],
      noticePeriodDays: 30,
      salaryVisibleToRecruiters: false,
    },
    {
      title: 'Senior Java Developer',
      location: 'Bangalore',
      workplaceType: 'HYBRID',
      employmentType: 'FULL_TIME',
      skillsRequired: ['Java', 'AWS'],
      skillsPreferred: ['Kafka', 'Spring Boot'],
      experienceMin: 6,
      experienceMax: 10,
    },
  );

  assert.equal(result.scoreVersion, 'careeriz-match-v1');
  assert.equal(result.subscores.requiredSkillScore, 100);
  assert.deepEqual(result.missingRequiredCriteria, []);
  assert.ok(result.explanation.includes('required skills'));
  assert.equal(result.unknownCriteria.includes('Age'), false);
});

test('deterministic talent search parsing only returns allowlisted filters', () => {
  const parsed = buildDeterministicQueryParse('Find senior Java developers in Bangalore with AWS, Kafka and a notice period under 30 days.');
  const validated = talentSearchParseOutputSchema.parse(parsed);

  assert.equal(validated.location, 'Bangalore');
  assert.deepEqual(validated.skills, ['Java', 'AWS', 'Kafka']);
  assert.equal(validated.noticePeriodDaysMax, 30);
  assert.equal(validated.applicationStatus, null);
});

test('provider URL validation rejects unsupported protocols and embedded credentials', () => {
  assert.throws(() => validateProviderBaseUrl('ftp://example.com/v1'), /Unsupported intelligence provider protocol/i);
  assert.throws(() => validateProviderBaseUrl('https://user:pass@example.com/v1'), /must not embed credentials/i);
});

test('structured output schemas reject unexpected properties', () => {
  assert.throws(() => candidateMatchExplanationOutputSchema.parse({
    explanation: 'Good fit',
    strengths: ['Java'],
    missingCriteria: [],
    unknownCriteria: [],
    dangerous: true,
  }));
});
