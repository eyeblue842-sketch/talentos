import test, { afterEach, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';

let app;
let prisma;
let signToken;
let env;
let state;
let originalStoragePath;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function now() {
  return new Date('2026-08-05T09:00:00.000Z');
}

function authHeader(userId) {
  return { Authorization: `Bearer ${signToken({ userId, sessionVersion: 0 })}` };
}

function jpegBuffer() {
  return Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00]);
}

function pngBuffer() {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
}

function webpBuffer() {
  return Buffer.from('52494646080000005745425056503820', 'hex');
}

function seedState() {
  state = {
    users: [
      { id: 'candidate-user-1', email: 'candidate1@example.com', role: 'CANDIDATE', isActive: true, sessionVersion: 0, emailVerifiedAt: now() },
      { id: 'candidate-user-2', email: 'candidate2@example.com', role: 'CANDIDATE', isActive: true, sessionVersion: 0, emailVerifiedAt: now() },
    ],
    candidateProfiles: [
      {
        id: 'candidate-1',
        userId: 'candidate-user-1',
        fullName: 'Candidate One',
        currentTitle: 'Frontend Engineer',
        location: 'Bengaluru',
        totalExperience: 4,
        profileImageUrl: null,
        skills: ['React'],
        preferredLocations: ['Bengaluru'],
        preferredRoles: ['Frontend Engineer'],
        workplacePreferences: ['HYBRID'],
        employmentPreferences: ['FULL_TIME'],
        availability: 'IMMEDIATE',
        noticePeriodDays: 30,
        sharedResumeSlug: 'candidate-one',
        updatedAt: now(),
      },
      {
        id: 'candidate-2',
        userId: 'candidate-user-2',
        fullName: 'Candidate Two',
        currentTitle: 'Backend Engineer',
        location: 'Remote',
        totalExperience: 5,
        profileImageUrl: null,
        skills: ['Node.js'],
        preferredLocations: ['Remote'],
        preferredRoles: ['Backend Engineer'],
        workplacePreferences: ['REMOTE'],
        employmentPreferences: ['FULL_TIME'],
        availability: 'ONE_MONTH',
        noticePeriodDays: 60,
        sharedResumeSlug: 'candidate-two',
        updatedAt: now(),
      },
    ],
  };
}

before(async () => {
  ({ app } = await import('../app.js'));
  ({ prisma } = await import('../config/db.js'));
  ({ signToken } = await import('../utils/jwt.js'));
  ({ env } = await import('../config/env.js'));
});

beforeEach(() => {
  seedState();
  originalStoragePath = env.localStoragePath;
  env.localStoragePath = '.tmp-candidate-profile-photo-tests';

  prisma.organisationMembership.findMany = async () => [];
  prisma.user.findUnique = async ({ where, include = {} } = {}) => {
    const user = state.users.find((item) => item.id === where.id) || null;
    if (!user) return null;
    return {
      ...clone(user),
      recruiterProfile: include.recruiterProfile ? null : undefined,
      candidateProfile: include.candidateProfile ? clone(state.candidateProfiles.find((item) => item.userId === user.id) || null) : undefined,
    };
  };
  prisma.candidateProfile.findUnique = async ({ where } = {}) => clone(state.candidateProfiles.find((item) => item.id === where.id) || null);
  prisma.candidateProfile.update = async ({ where, data } = {}) => {
    const profile = state.candidateProfiles.find((item) => item.id === where.id);
    Object.assign(profile, data, { updatedAt: now() });
    return clone(profile);
  };
  prisma.candidateActivity = {
    create: async () => ({}),
  };
  prisma.auditLog = {
    create: async () => ({}),
  };
});

afterEach(() => {
  fs.rmSync(path.resolve(process.cwd(), env.localStoragePath), { recursive: true, force: true });
  env.localStoragePath = originalStoragePath;
});

test('authenticated candidate can upload, fetch, replace, and remove a JPG profile photo', async () => {
  const uploadResponse = await request(app)
    .post('/api/candidate/profile-photo')
    .set(authHeader('candidate-user-1'))
    .attach('photo', jpegBuffer(), { filename: 'avatar.jpg', contentType: 'image/jpeg' });

  assert.equal(uploadResponse.status, 200);
  assert.match(uploadResponse.body.data.profile.profileImageUrl, /^private:local:candidate-profile-photos\//);

  const firstReference = state.candidateProfiles[0].profileImageUrl;
  const readResponse = await request(app)
    .get('/api/candidate/profile-photo')
    .set(authHeader('candidate-user-1'));

  assert.equal(readResponse.status, 200);
  assert.equal(readResponse.headers['content-type'], 'image/jpeg');

  const replaceResponse = await request(app)
    .post('/api/candidate/profile-photo')
    .set(authHeader('candidate-user-1'))
    .attach('photo', pngBuffer(), { filename: 'avatar.png', contentType: 'image/png' });

  assert.equal(replaceResponse.status, 200);
  assert.notEqual(state.candidateProfiles[0].profileImageUrl, firstReference);

  const removeResponse = await request(app)
    .delete('/api/candidate/profile-photo')
    .set(authHeader('candidate-user-1'));

  assert.equal(removeResponse.status, 200);
  assert.equal(state.candidateProfiles[0].profileImageUrl, null);
});

test('png and webp profile photos are accepted', async () => {
  const pngResponse = await request(app)
    .post('/api/candidate/profile-photo')
    .set(authHeader('candidate-user-1'))
    .attach('photo', pngBuffer(), { filename: 'avatar.png', contentType: 'image/png' });

  assert.equal(pngResponse.status, 200);

  const webpResponse = await request(app)
    .post('/api/candidate/profile-photo')
    .set(authHeader('candidate-user-1'))
    .attach('photo', webpBuffer(), { filename: 'avatar.webp', contentType: 'image/webp' });

  assert.equal(webpResponse.status, 200);
});

test('unsupported, oversized, and unauthenticated uploads are rejected', async () => {
  const unsupportedResponse = await request(app)
    .post('/api/candidate/profile-photo')
    .set(authHeader('candidate-user-1'))
    .attach('photo', Buffer.from('GIF89a'), { filename: 'avatar.gif', contentType: 'image/gif' });

  assert.equal(unsupportedResponse.status, 400);
  assert.equal(unsupportedResponse.body.message, 'Please upload a JPG, PNG, or WebP image.');

  const oversizedResponse = await request(app)
    .post('/api/candidate/profile-photo')
    .set(authHeader('candidate-user-1'))
    .attach('photo', Buffer.concat([pngBuffer(), Buffer.alloc((5 * 1024 * 1024) + 1)]), { filename: 'huge.png', contentType: 'image/png' });

  assert.equal(oversizedResponse.status, 400);
  assert.equal(oversizedResponse.body.message, 'Profile photo must be smaller than 5 MB.');

  const unauthenticatedResponse = await request(app)
    .post('/api/candidate/profile-photo')
    .attach('photo', jpegBuffer(), { filename: 'avatar.jpg', contentType: 'image/jpeg' });

  assert.equal(unauthenticatedResponse.status, 401);
});
