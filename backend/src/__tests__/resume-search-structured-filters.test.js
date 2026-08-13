import assert from 'node:assert/strict';
import test from 'node:test';
import { filterCandidateRows } from '../services/search/candidateSearchFilterService.js';
import { normalizeDegree } from '../services/search/educationNormalization.js';

const base = {
  id: 'candidate-1',
  location: 'Bangalore, Karnataka',
  preferredLocations: ['Pune'],
  willingToRelocate: true,
  currentEmployer: 'TechAffinity Consulting Pvt. Ltd.',
  currentDesignation: 'Senior Java Developer',
  workAuthorization: 'India',
  employmentPreferences: ['FULL_TIME'],
  currentTitle: 'Senior Java Developer',
  totalExperience: 7,
  currentCtcLpa: 20,
  noticePeriodDays: 30,
  emailVerifiedAt: new Date(),
  user: { emailVerifiedAt: new Date() },
  latestResumeAssetId: 'asset-1',
  latestResumeAsset: { id: 'asset-1', status: 'ACTIVE', kind: 'RESUME', updatedAt: new Date() },
  createdAt: new Date(),
  updatedAt: new Date(),
  lastActiveAt: new Date(Date.now() - 2 * 86400000),
  skills: ['Java', 'Spring Boot'],
  educationEntries: [{ degree: 'Bachelor of Technology', institution: 'VTU', completionYear: 2018, educationType: 'Full Time' }, { degree: 'MBA', institution: 'IIM', completionYear: 2022 }],
  experienceEntries: [{ company: 'TechAffinity Consulting Pvt. Ltd.', title: 'Senior Java Developer', isCurrent: true }, { company: 'Old Systems Ltd', title: 'Java Developer', isCurrent: false }],
};

test('normalizes degree aliases without collapsing levels', () => {
  assert.deepEqual(normalizeDegree('Bachelor of Technology'), { canonical: 'B.Tech', level: 'UG' });
  assert.deepEqual(normalizeDegree('MBA/PGDM'), { canonical: 'MBA', level: 'PG' });
  assert.deepEqual(normalizeDegree('PhD'), { canonical: 'PhD', level: 'PPG' });
});

test('filters education by level, course, institute, type, and completion year', () => {
  assert.equal(filterCandidateRows([base], {
    educationFilters: {
      ug: { mode: 'SPECIFIC', course: 'B.Tech', institute: 'VTU', educationType: 'Full Time', completionYearFrom: 2017, completionYearTo: 2019 },
      pg: { mode: 'ANY' },
    },
  }).length, 1);
  assert.equal(filterCandidateRows([base], { educationFilters: { ppg: { mode: 'ANY' } } }).length, 0);
  assert.equal(filterCandidateRows([base], { educationFilters: { requireUgPg: true } }).length, 1);
});

test('matches preferred locations and relocation without treating history as current', () => {
  assert.equal(filterCandidateRows([base], { locations: ['Pune'], includeWillingToRelocate: true }).length, 1);
  assert.equal(filterCandidateRows([base], { locations: ['Pune'] }).length, 0);
  assert.equal(filterCandidateRows([base], { preferredLocations: ['Pune'] }).length, 1);
});

test('supports scoped company/designation and recruiter-safe profile filters', () => {
  assert.equal(filterCandidateRows([base], { currentCompany: 'TechAffinity Consulting', companyScope: 'current' }).length, 1);
  assert.equal(filterCandidateRows([base], { currentCompany: 'Tech', companyScope: 'current' }).length, 0);
  assert.equal(filterCandidateRows([base], { currentCompany: 'Old Systems', companyScope: 'current' }).length, 0);
  assert.equal(filterCandidateRows([base], { previousCompany: 'Old Systems' }).length, 1);
  assert.equal(filterCandidateRows([base], { designation: 'Java Developer', designationScope: 'previous' }).length, 1);
  assert.equal(filterCandidateRows([base], { resumeAttachment: 'Available', emailVerified: true, workAuthorization: 'India' }).length, 1);
});

test('filters supported additional work, display, verification, and activity fields server-side', () => {
  assert.equal(filterCandidateRows([base], { jobTypes: ['PERMANENT'], employmentTypes: ['FULL_TIME'], workPermitCountries: ['India'], displayCandidateType: 'NEW_REGISTRATIONS', profileRecencyDays: 30, activeWithin: 30, emailVerified: true, resumeAttachment: 'Available' }).length, 1);
  assert.equal(filterCandidateRows([base], { jobTypes: ['CONTRACT'] }).length, 0);
  assert.equal(filterCandidateRows([base], { activeWithin: 1 }).length, 0);
});
