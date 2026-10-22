import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDeterministicResumeParse,
  computeExperienceMonths,
  pickCurrentExperienceEntry,
} from '../services/resumeImportUtils.js';

const NOW = new Date(Date.UTC(2026, 9, 22));

test('experience months are counted from the from/to dates of each role', () => {
  const months = computeExperienceMonths([
    { company: 'Alpha', startDate: 'Jan 2018', endDate: 'Dec 2019' },
    { company: 'Beta', startDate: 'Mar 2020', endDate: 'Feb 2022' },
  ], NOW);
  assert.equal(months, 24 + 24);
});

test('a present role runs up to today and overlapping roles are only counted once', () => {
  const months = computeExperienceMonths([
    { company: 'Alpha', startDate: 'Jan 2024', currentlyWorking: true },
    { company: 'Side gig', startDate: 'Jun 2024', endDate: 'Dec 2024' },
  ], NOW);
  // Jan 2024 .. Oct 2026 inclusive
  assert.equal(months, 34);
});

test('year-only dates and roles without usable dates are handled', () => {
  assert.equal(computeExperienceMonths([{ startDate: '2019', endDate: '2020' }], NOW), 24);
  assert.equal(computeExperienceMonths([{ company: 'No dates' }, { startDate: 'Jan 2020' }], NOW), 0);
});

test('current role is the ongoing one, otherwise the one that ended last', () => {
  const ongoing = pickCurrentExperienceEntry([
    { company: 'Old', endDate: 'Dec 2019' },
    { company: 'Now', currentlyWorking: true },
  ]);
  assert.equal(ongoing.company, 'Now');

  const latest = pickCurrentExperienceEntry([
    { company: 'First', startDate: '2015', endDate: 'Dec 2017' },
    { company: 'Second', startDate: '2018', endDate: 'Jun 2021' },
  ]);
  assert.equal(latest.company, 'Second');
});

test('resume parsing takes the current company and designation and counts total experience from the dates', () => {
  const text = [
    'Priya Nair',
    'priya@example.com',
    '+91 98765 43210',
    'Bengaluru, Karnataka',
    '',
    'EXPERIENCE',
    'Senior Java Developer | Acme Systems',
    'Jan 2022 - Present',
    '- Built payment services in Java and Spring Boot.',
    '',
    'Java Developer | Beta Technologies',
    'Jun 2018 - Dec 2021',
    '- Maintained banking APIs.',
    '',
    'EDUCATION',
    'B.Tech Computer Science, 2018',
  ].join('\n');
  const parsed = buildDeterministicResumeParse(text, 'priya.pdf');
  const candidate = parsed.candidate;
  assert.equal(candidate.currentEmployer.value, 'Acme Systems');
  assert.equal(candidate.currentDesignation.value, 'Senior Java Developer');
  assert.equal(candidate.currentTitle.value, candidate.currentDesignation.value);
  // Jun 2018 - Dec 2021 (43 months) + Jan 2022 - Oct 2026 (58 months, up to the current month) -> about 8 years
  assert.ok(candidate.totalExperience.value >= 7, `total experience was ${candidate.totalExperience.value}`);
});
