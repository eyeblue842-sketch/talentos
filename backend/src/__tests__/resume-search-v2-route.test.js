import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

let app;
let prisma;
let signToken;
let env;

function authHeader(userId) {
  return { Authorization: `Bearer ${signToken({ userId, sessionVersion: 0 })}` };
}

before(async () => {
  process.env.NODE_ENV = 'test';
  ({ app } = await import('../app.js'));
  ({ prisma } = await import('../config/db.js'));
  ({ signToken } = await import('../utils/jwt.js'));
  ({ env } = await import('../config/env.js'));
});

beforeEach(() => {
  env.resumeSearchV2Enabled = false;

  prisma.organisationMembership.findMany = async () => ([
    {
      id: 'membership-1',
      organisationId: 'org-1',
      userId: 'recruiter-user-1',
      role: 'RECRUITER',
      organisation: { id: 'org-1', name: 'Org One' },
    },
  ]);
  prisma.user.findUnique = async ({ where, include = {} }) => {
    if (where.id !== 'recruiter-user-1') return null;
    return {
      id: 'recruiter-user-1',
      email: 'recruiter@example.com',
      role: 'RECRUITER',
      isActive: true,
      sessionVersion: 0,
      mustChangePassword: false,
      recruiterProfile: include.recruiterProfile ? { id: 'recruiter-profile-1', organisationId: 'org-1' } : undefined,
      candidateProfile: include.candidateProfile ? null : undefined,
    };
  };
});

test('search v2 endpoint remains disabled by default without affecting legacy route registration', async () => {
  const response = await request(app)
    .post('/api/resumes/search/v2')
    .set(authHeader('recruiter-user-1'))
    .send({
      keywords: [{ term: 'Java', mode: 'MUST' }],
      phrases: [],
      filters: {},
      sort: 'RELEVANCE',
      pageSize: 10,
      cursor: null,
    });

  assert.equal(response.status, 404);
  assert.equal(response.body.details.code, 'RESUME_SEARCH_V2_DISABLED');
});
