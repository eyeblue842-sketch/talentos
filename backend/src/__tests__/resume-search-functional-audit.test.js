import assert from 'node:assert/strict';
import test from 'node:test';
import { filterCandidateRows } from '../services/search/candidateSearchFilterService.js';

const daysAgo = (days) => new Date(Date.now() - days * 86400000);

const candidates = [
  {
    id: 'candidate-a',
    location: 'Bengaluru, Karnataka',
    preferredLocations: ['Hyderabad'],
    willingToRelocate: false,
    currentEmployer: 'Tata Consultancy Services Pvt. Ltd.',
    currentDesignation: 'Senior Java Developer',
    totalExperience: 7,
    currentCtcLpa: 20,
    noticePeriodDays: 30,
    employmentPreferences: ['FULL_TIME'],
    workAuthorization: 'India',
    skills: ['Java', 'Spring Boot', 'AWS'],
    educationEntries: [{ degree: 'B.Tech', institution: 'VTU', educationType: 'Full Time', completionYear: 2018 }, { degree: 'MBA', institution: 'IIM', completionYear: 2022 }],
    experienceEntries: [{ company: 'Tata Consultancy Services Pvt. Ltd.', title: 'Senior Java Developer', isCurrent: true }],
    user: { emailVerifiedAt: daysAgo(1) },
    latestResumeAsset: { kind: 'RESUME', status: 'ACTIVE', updatedAt: daysAgo(2) },
    createdAt: daysAgo(10),
    updatedAt: daysAgo(2),
    lastActiveAt: daysAgo(5),
  },
  {
    id: 'candidate-b',
    location: 'Hyderabad, Telangana',
    preferredLocations: ['Bengaluru'],
    willingToRelocate: false,
    currentEmployer: 'Oracle India',
    currentDesignation: 'Oracle EBS Consultant',
    totalExperience: 9,
    currentCtcLpa: 28,
    noticePeriodDays: 60,
    employmentPreferences: ['FULL_TIME'],
    workAuthorization: 'Canada',
    skills: ['Oracle EBS', 'PL/SQL'],
    educationEntries: [{ degree: 'B.E.', institution: 'Osmania University', educationType: 'Full Time', completionYear: 2015 }, { degree: 'MCA', institution: 'JNTU', completionYear: 2018 }],
    experienceEntries: [{ company: 'Oracle India', title: 'Oracle EBS Consultant', isCurrent: true }, { company: 'Tata Consultancy Services', title: 'Oracle Consultant', isCurrent: false }],
    user: { emailVerifiedAt: daysAgo(2) },
    latestResumeAsset: { kind: 'RESUME', status: 'ACTIVE', updatedAt: daysAgo(5) },
    createdAt: daysAgo(120),
    updatedAt: daysAgo(5),
    lastActiveAt: daysAgo(60),
  },
  {
    id: 'candidate-c',
    location: 'Chennai, Tamil Nadu',
    preferredLocations: ['Pune'],
    willingToRelocate: true,
    currentEmployer: 'DataWorks',
    currentDesignation: 'Python Developer',
    totalExperience: 4,
    currentCtcLpa: 15,
    noticePeriodDays: 15,
    employmentPreferences: ['FULL_TIME'],
    workAuthorization: 'Canada',
    skills: ['Python', 'SQL'],
    educationEntries: [{ degree: 'B.Sc', institution: 'Madras University', completionYear: 2021 }],
    experienceEntries: [{ company: 'DataWorks', title: 'Python Developer', isCurrent: true }],
    user: { emailVerifiedAt: null },
    latestResumeAsset: { kind: 'RESUME', status: 'ACTIVE', updatedAt: daysAgo(3) },
    createdAt: daysAgo(200),
    updatedAt: daysAgo(3),
    lastActiveAt: daysAgo(10),
  },
];

function ids(filters) {
  return filterCandidateRows(candidates, filters).map((candidate) => candidate.id);
}

test('functional audit: Java/Bengaluru/notice/salary/activity criteria returns candidate A only', () => {
  assert.deepEqual(ids({
    skills: ['Java', 'Spring Boot'],
    locations: ['Bengaluru'],
    minExperience: 6,
    maxExperience: 10,
    salaryMin: 18,
    salaryMax: 22,
    noticePeriod: '30 Days',
    employmentTypes: ['FULL_TIME'],
    jobTypes: ['PERMANENT'],
    activeWithin: 30,
    resumeAttachment: 'Available',
  }), ['candidate-a']);
});

test('functional audit: Oracle/company/UG/PG/email criteria returns candidate B only', () => {
  assert.deepEqual(ids({
    skills: ['Oracle EBS'],
    locations: ['Hyderabad', 'Bengaluru'],
    currentCompany: 'Tata Consultancy Services',
    companyScope: 'any',
    educationFilters: { ug: { mode: 'ANY' }, pg: { mode: 'ANY' } },
    emailVerified: true,
    activeWithin: 90,
  }), ['candidate-b']);
});

test('functional audit: preferred location/relocation/work permit/modified criteria returns candidate C only', () => {
  assert.deepEqual(ids({
    skills: ['Python'],
    preferredLocations: ['Pune'],
    includeWillingToRelocate: true,
    workPermitCountries: ['Canada'],
    displayCandidateType: 'MODIFIED',
    profileRecencyDays: 30,
  }), ['candidate-c']);
});

test('functional audit: total filtered count is independent of a page slice', () => {
  const filtered = filterCandidateRows(candidates, { workAuthorization: 'Canada' });
  assert.equal(filtered.length, 2);
  assert.deepEqual(filtered.slice(0, 1).map((candidate) => candidate.id), ['candidate-b']);
  assert.deepEqual(filtered.slice(1, 2).map((candidate) => candidate.id), ['candidate-c']);
});
