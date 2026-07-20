import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

let app;
let prisma;
let signToken;
let state;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function now() {
  return new Date('2026-07-17T12:00:00.000Z');
}

function authHeader(userId) {
  return { Authorization: `Bearer ${signToken({ userId, sessionVersion: 0 })}` };
}

function seedState() {
  state = {
    users: [
      { id: 'candidate-user-1', email: 'candidate1@example.com', role: 'CANDIDATE', isActive: true, sessionVersion: 0, emailVerifiedAt: now() },
      { id: 'recruiter-user-1', email: 'recruiter@example.com', role: 'RECRUITER', isActive: true, sessionVersion: 0, emailVerifiedAt: now() },
    ],
    candidateProfiles: [
      {
        id: 'candidate-1',
        userId: 'candidate-user-1',
        fullName: 'Candidate One',
        currentTitle: 'Frontend Engineer',
        headline: 'Builds polished UI',
        location: 'Bengaluru',
        preferredLocations: ['Bengaluru'],
        preferredRoles: ['frontend engineer'],
        totalExperience: 4,
        workplacePreferences: ['HYBRID'],
        employmentPreferences: ['FULL_TIME'],
        availability: 'IMMEDIATE',
        noticePeriodDays: 30,
        currentCtcLpa: 12,
        expectedCtcLpa: 18,
        skills: ['React', 'Next.js'],
        summary: 'Candidate summary',
        profileVisibility: 'PRIVATE',
        recommendationEnabled: true,
        notifyForSavedJobUpdates: true,
        notifyForRecommendations: true,
        notifyForInterviews: true,
        notifyForApplicationUpdates: true,
        notifyForOffers: true,
        notifyForProfileReminders: true,
        notifyForMarketing: false,
        willingToRelocate: false,
        requiresVisaSponsorship: false,
        preferredIndustries: [],
        preferredCompanySizes: [],
        jobAlertEnabled: true,
        jobAlertFrequency: 'WEEKLY',
        profileViews: 2,
        sharedResumeSlug: 'candidate-one',
        updatedAt: now(),
      },
    ],
  };
}

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.ELASTICSEARCH_ENABLED = 'false';
  ({ app } = await import('../app.js'));
  ({ prisma } = await import('../config/db.js'));
  ({ signToken } = await import('../utils/jwt.js'));
});

beforeEach(() => {
  seedState();

  prisma.organisationMembership.findMany = async () => [];
  prisma.user.findUnique = async ({ where, include = {} }) => {
    const user = state.users.find((item) => item.id === where.id) || null;
    if (!user) return null;
    return {
      ...clone(user),
      recruiterProfile: include.recruiterProfile ? null : undefined,
      candidateProfile: include.candidateProfile ? clone(state.candidateProfiles.find((item) => item.userId === user.id) || null) : undefined,
    };
  };
  prisma.candidateProfile.findUnique = async ({ where, include = {} }) => {
    const profile = state.candidateProfiles.find((item) => item.id === where.id) || null;
    if (!profile) return null;
    return {
      ...clone(profile),
      resumeBuilder: include.resumeBuilder ? null : undefined,
    };
  };
  prisma.candidateProfile.findMany = async () => state.candidateProfiles.map((profile) => ({
    ...clone(profile),
    resumeBuilder: null,
  }));
  prisma.candidateActivity = {
    create: async () => ({}),
  };
  prisma.auditLog = {
    create: async () => ({}),
  };
  prisma.savedCandidate = {
    findMany: async () => [],
  };
  prisma.application = {
    findMany: async () => [],
  };
});

test('resume search endpoint falls back to database search when Elasticsearch is disabled', async () => {
  const response = await request(app)
    .get('/api/resumes/search')
    .set(authHeader('recruiter-user-1'));

  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.meta.searchMode, 'database');
  assert.match(response.body.meta.warning, /standard database fallback/i);
});

test('candidate profile endpoint continues working when Elasticsearch is disabled', async () => {
  const response = await request(app)
    .get('/api/candidate/profile')
    .set(authHeader('candidate-user-1'));

  assert.equal(response.status, 200);
  assert.equal(response.body.data.profile.id, 'candidate-1');
});
