import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesWorkPreferences } from '../services/search/candidateSearchFilterService.js';
import { parseSearchQuery } from '../intelligence/services/queryParserService.js';
import { candidateProfileUpdateSchema } from '@careeriz/shared';

test('recruiter search for freelancer / intern / contract returns candidates who ticked that preference', () => {
  const freelancer = { employmentPreferences: ['FULL_TIME', 'FREELANCE'] };
  const intern = { employmentPreferences: ['INTERN'] };
  const contract = { employmentPreferences: ['CONTRACT'] };

  assert.equal(matchesWorkPreferences(freelancer, { employmentTypes: ['FREELANCE'] }), true);
  assert.equal(matchesWorkPreferences(intern, { employmentTypes: ['FREELANCE'] }), false);
  assert.equal(matchesWorkPreferences(intern, { employmentTypes: ['INTERN'] }), true);
  assert.equal(matchesWorkPreferences(contract, { employmentTypes: ['CONTRACT'] }), true);
  assert.equal(matchesWorkPreferences(contract, { employmentTypes: ['FREELANCE', 'INTERN'] }), false);
});

test('typing freelancer, intern or contract in the search box sets the employment type filter', () => {
  assert.deepEqual(parseSearchQuery({ query: 'freelancer react developer' }).filters.employmentTypes, ['FREELANCE']);
  assert.deepEqual(parseSearchQuery({ query: 'freelance designer' }).filters.employmentTypes, ['FREELANCE']);
  assert.deepEqual(parseSearchQuery({ query: 'intern python' }).filters.employmentTypes, ['INTERN']);
  assert.deepEqual(parseSearchQuery({ query: 'contract devops' }).filters.employmentTypes, ['CONTRACT']);
});

test('the candidate profile accepts the freelance preference and a salary-negotiable answer', () => {
  const parsed = candidateProfileUpdateSchema.safeParse({
    fullName: 'Asha Rao',
    employmentPreferences: ['FULL_TIME', 'CONTRACT', 'INTERN', 'PART_TIME', 'FREELANCE'],
    salaryNegotiable: true,
  });
  assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
  assert.equal(parsed.data.salaryNegotiable, true);
});
