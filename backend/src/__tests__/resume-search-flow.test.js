import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSearchQuery } from '../intelligence/services/queryParserService.js';
import { buildDbWhere } from '../services/search/searchUtils.js';

test('structured Resume Search filters survive parsing without a keyword query', () => {
  const parsed = parseSearchQuery({
    query: '',
    filters: {
      minExperience: 6,
      maxExperience: 10,
      locations: ['Bengaluru, Karnataka', 'Chennai, Tamil Nadu'],
      requiredSkills: ['Java', 'Spring Boot'],
    },
  });

  assert.equal(parsed.filters.minExperience, 6);
  assert.deepEqual(parsed.filters.locations, ['Bengaluru, Karnataka', 'Chennai, Tamil Nadu']);
  assert.deepEqual(parsed.filters.requiredSkills, ['Java', 'Spring Boot']);
});

test('multiple recruiter locations use OR matching in the database search contract', () => {
  const where = buildDbWhere({ locations: ['Bengaluru, Karnataka', 'Chennai, Tamil Nadu'] });

  assert.equal(where.location, undefined);
  assert.deepEqual(where.AND, [{
    OR: [
      { location: { contains: 'Bengaluru, Karnataka', mode: 'insensitive' } },
      { location: { contains: 'Chennai, Tamil Nadu', mode: 'insensitive' } },
    ],
  }]);
});

test('natural language interpretation populates supported education, relocation, and company filters', () => {
  const parsed = parseSearchQuery({ query: 'MBA candidates graduating after 2020 willing to relocate to Pune' });
  assert.equal(parsed.filters.educationFilters.pg.course, 'MBA');
  assert.equal(parsed.filters.educationFilters.pg.completionYearFrom, 2020);
  assert.deepEqual(parsed.filters.preferredLocations, ['Pune']);
  assert.equal(parsed.filters.includeWillingToRelocate, true);

  const companyParsed = parseSearchQuery({ query: 'Current Java developers at TCS' });
  assert.equal(companyParsed.filters.currentEmployer, 'TCS');
  assert.equal(companyParsed.filters.companyScope, 'current');
});

test('natural language interpretation populates supported additional details', () => {
  const parsed = parseSearchQuery({ query: 'Permanent Java developers active in the last 30 days with verified email and attached resume' });
  assert.deepEqual(parsed.filters.jobTypes, ['PERMANENT']);
  assert.deepEqual(parsed.filters.employmentTypes, ['FULL_TIME']);
  assert.equal(parsed.filters.activeWithin, 30);
  assert.equal(parsed.filters.emailVerified, true);
  assert.equal(parsed.filters.resumeAttachment, 'Available');

  const permit = parseSearchQuery({ query: 'Java developers with Canadian work authorization' });
  assert.deepEqual(permit.filters.workPermitCountries, ['Canada']);
});
