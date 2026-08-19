import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.NETWORK_REQUEST_RATE_LIMIT = '2';
process.env.NETWORK_REQUEST_WINDOW_MINUTES = '60';

let app;
let prisma;
let signToken;
let state;

function now() {
  return new Date('2026-08-12T10:00:00.000Z');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function authHeader(userId) {
  return { Authorization: `Bearer ${signToken({ userId, sessionVersion: 0 })}` };
}

function withUserRelations(user) {
  return {
    ...clone(user),
    candidateProfile: clone(state.candidateProfiles.find((item) => item.userId === user.id) || null),
    recruiterProfile: (() => {
      const profile = state.recruiterProfiles.find((item) => item.userId === user.id);
      if (!profile) return null;
      return {
        ...clone(profile),
        organisation: clone(state.organisations.find((item) => item.id === profile.organisationId) || null),
      };
    })(),
    networkPrivacySettings: clone(state.networkPrivacySettings.find((item) => item.userId === user.id) || null),
  };
}

function seedState() {
  state = {
    users: [
      { id: 'candidate-user-1', email: 'candidate1@example.com', role: 'CANDIDATE', isActive: true, sessionVersion: 0, name: 'Candidate One' },
      { id: 'candidate-user-2', email: 'candidate2@example.com', role: 'CANDIDATE', isActive: true, sessionVersion: 0, name: 'Candidate Two' },
      { id: 'recruiter-user-1', email: 'recruiter1@example.com', role: 'RECRUITER', isActive: true, sessionVersion: 0, name: 'Anita Sharma' },
      { id: 'recruiter-user-2', email: 'recruiter2@example.com', role: 'RECRUITER', isActive: true, sessionVersion: 0, name: 'Rahul Mehta' },
    ],
    candidateProfiles: [
      {
        id: 'candidate-1',
        userId: 'candidate-user-1',
        fullName: 'Candidate One',
        headline: 'Java and Spring Boot engineer',
        currentTitle: 'Software Engineer',
        currentDesignation: 'Software Engineer',
        currentEmployer: 'Acme Labs',
        location: 'Bengaluru',
        totalExperience: 4,
        skills: ['Java', 'Spring Boot', 'PostgreSQL'],
        functionalSkills: ['Backend'],
        educationEntries: [{ degree: 'B.Tech', institution: 'NIT' }],
        searchableProfile: true,
        profileVisibility: 'PUBLIC',
        profileImageUrl: null,
        updatedAt: now(),
      },
      {
        id: 'candidate-2',
        userId: 'candidate-user-2',
        fullName: 'Candidate Two',
        headline: 'Private data engineer',
        currentTitle: 'Data Engineer',
        currentDesignation: 'Data Engineer',
        currentEmployer: 'Stealth Data',
        location: 'Pune',
        totalExperience: 5,
        skills: ['Python', 'Airflow'],
        functionalSkills: ['Data'],
        educationEntries: [{ degree: 'B.Tech', institution: 'IIT' }],
        searchableProfile: true,
        profileVisibility: 'RECRUITERS_ONLY',
        profileImageUrl: null,
        updatedAt: now(),
      },
    ],
    recruiterProfiles: [
      {
        id: 'recruiter-profile-1',
        userId: 'recruiter-user-1',
        organisationId: 'org-1',
        companyEmailDomain: 'acme.com',
        companyName: 'Acme Labs',
        industryDomain: 'FinTech',
        headquartersLocation: 'Bengaluru',
        designation: 'Senior Talent Acquisition Manager',
        companyType: 'Product',
        workingSince: 2018,
        officeLocations: ['Bengaluru'],
        profileCompleted: true,
      },
      {
        id: 'recruiter-profile-2',
        userId: 'recruiter-user-2',
        organisationId: 'org-1',
        companyEmailDomain: 'acme.com',
        companyName: 'Acme Labs',
        industryDomain: 'FinTech',
        headquartersLocation: 'Bengaluru',
        designation: 'Lead Recruiter',
        companyType: 'Product',
        workingSince: 2020,
        officeLocations: ['Bengaluru'],
        profileCompleted: true,
      },
    ],
    organisations: [
      { id: 'org-1', name: 'Acme Labs', slug: 'acme-labs', status: 'ACTIVE', careersEnabled: true, industry: 'FinTech', headquarters: 'Bengaluru', publicLocations: ['Bengaluru'] },
    ],
    networkPrivacySettings: [
      { id: 'privacy-1', userId: 'candidate-user-1', allowConnectionRequestsFrom: 'EVERYONE', connectionVisibility: 'CONNECTIONS_ONLY', showInPeopleSearch: true, showRecruiterIdentity: true },
      { id: 'privacy-2', userId: 'candidate-user-2', allowConnectionRequestsFrom: 'RECRUITERS_ONLY', connectionVisibility: 'CONNECTIONS_ONLY', showInPeopleSearch: true, showRecruiterIdentity: true },
      { id: 'privacy-3', userId: 'recruiter-user-1', allowConnectionRequestsFrom: 'EVERYONE', connectionVisibility: 'EVERYONE', showInPeopleSearch: true, showRecruiterIdentity: true },
      { id: 'privacy-4', userId: 'recruiter-user-2', allowConnectionRequestsFrom: 'EVERYONE', connectionVisibility: 'EVERYONE', showInPeopleSearch: true, showRecruiterIdentity: true },
    ],
    connections: [
      {
        id: 'connection-accepted-1',
        requesterUserId: 'candidate-user-1',
        receiverUserId: 'recruiter-user-2',
        pairKey: 'candidate-user-1:recruiter-user-2',
        status: 'ACCEPTED',
        source: 'PROFILE',
        createdAt: now(),
        updatedAt: now(),
        acceptedAt: now(),
      },
      {
        id: 'connection-accepted-2',
        requesterUserId: 'candidate-user-2',
        receiverUserId: 'recruiter-user-2',
        pairKey: 'candidate-user-2:recruiter-user-2',
        status: 'ACCEPTED',
        source: 'PROFILE',
        createdAt: now(),
        updatedAt: now(),
        acceptedAt: now(),
      },
    ],
    blocks: [],
    notifications: [],
    companyFollows: [],
  };
}

before(async () => {
  ({ app } = await import('../app.js'));
  ({ prisma } = await import('../config/db.js'));
  ({ signToken } = await import('../utils/jwt.js'));
});

beforeEach(() => {
  seedState();

  prisma.organisationMembership.findMany = async () => [];

  prisma.user.findUnique = async ({ where }) => {
    const user = state.users.find((item) => item.id === where.id) || null;
    return user ? withUserRelations(user) : null;
  };

  prisma.user.findMany = async ({ where = {}, take } = {}) => {
    let rows = state.users.filter((item) => item.isActive);
    if (where.id?.in) rows = rows.filter((item) => where.id.in.includes(item.id));
    if (where.id?.notIn) rows = rows.filter((item) => !where.id.notIn.includes(item.id));
    if (where.role?.in) rows = rows.filter((item) => where.role.in.includes(item.role));
    if (where.candidateProfile?.isNot === null) rows = rows.filter((item) => state.candidateProfiles.some((profile) => profile.userId === item.id));
    if (where.recruiterProfile?.isNot === null) rows = rows.filter((item) => state.recruiterProfiles.some((profile) => profile.userId === item.id));
    if (where.recruiterProfile?.is?.organisationId) {
      rows = rows.filter((item) => state.recruiterProfiles.some((profile) => profile.userId === item.id && profile.organisationId === where.recruiterProfile.is.organisationId));
    }
    return rows.slice(0, take || rows.length).map(withUserRelations);
  };

  prisma.userConnection.findUnique = async ({ where }) => {
    const row = state.connections.find((item) => (
      (where.id && item.id === where.id) || (where.pairKey && item.pairKey === where.pairKey)
    )) || null;
    return row ? clone(row) : null;
  };

  prisma.userConnection.findMany = async ({ where = {}, include = {}, orderBy, skip = 0, take } = {}) => {
    let rows = state.connections.filter((item) => {
      if (where.status && item.status !== where.status) return false;
      if (where.requesterUserId && item.requesterUserId !== where.requesterUserId) return false;
      if (where.receiverUserId && item.receiverUserId !== where.receiverUserId) return false;
      if (where.OR) {
        const orMatch = where.OR.some((clause) => (
          (clause.requesterUserId && clause.requesterUserId === item.requesterUserId)
          || (clause.receiverUserId && clause.receiverUserId === item.receiverUserId)
        ));
        if (!orMatch) return false;
      }
      return true;
    });

    rows = rows.slice(skip, take ? skip + take : undefined).map(clone);
    if (include.requesterUser || include.receiverUser) {
      rows = rows.map((row) => ({
        ...row,
        requesterUser: include.requesterUser ? withUserRelations(state.users.find((item) => item.id === row.requesterUserId)) : undefined,
        receiverUser: include.receiverUser ? withUserRelations(state.users.find((item) => item.id === row.receiverUserId)) : undefined,
      }));
    }
    return rows;
  };

  prisma.userConnection.count = async ({ where = {} } = {}) => (
    state.connections.filter((item) => {
      if (where.status && item.status !== where.status) return false;
      if (where.requesterUserId && item.requesterUserId !== where.requesterUserId) return false;
      if (where.receiverUserId && item.receiverUserId !== where.receiverUserId) return false;
      return true;
    }).length
  );

  prisma.userConnection.create = async ({ data }) => {
    const row = {
      id: `connection-${state.connections.length + 1}`,
      createdAt: now(),
      updatedAt: now(),
      acceptedAt: null,
      ...clone(data),
    };
    state.connections.push(row);
    return clone(row);
  };

  prisma.userConnection.update = async ({ where, data }) => {
    const row = state.connections.find((item) => item.id === where.id);
    Object.assign(row, clone(data), { updatedAt: now() });
    return clone(row);
  };

  prisma.userConnection.delete = async ({ where }) => {
    state.connections = state.connections.filter((item) => item.id !== where.id);
  };

  prisma.userBlock.findFirst = async ({ where = {} } = {}) => {
    const row = state.blocks.find((item) => where.OR.some((clause) => clause.blockerUserId === item.blockerUserId && clause.blockedUserId === item.blockedUserId)) || null;
    return row ? clone(row) : null;
  };

  prisma.userBlock.findMany = async ({ where = {}, select } = {}) => {
    const rows = state.blocks.filter((item) => (
      where.OR.some((clause) => (
        (clause.blockerUserId && clause.blockerUserId === item.blockerUserId)
        || (clause.blockedUserId && clause.blockedUserId === item.blockedUserId)
      ))
    ));
    return rows.map((row) => (select ? { blockerUserId: row.blockerUserId, blockedUserId: row.blockedUserId } : clone(row)));
  };

  prisma.userBlock.upsert = async ({ where, create }) => {
    const existing = state.blocks.find((item) => item.blockerUserId === where.blockerUserId_blockedUserId.blockerUserId && item.blockedUserId === where.blockerUserId_blockedUserId.blockedUserId);
    if (existing) return clone(existing);
    const row = { id: `block-${state.blocks.length + 1}`, createdAt: now(), ...clone(create) };
    state.blocks.push(row);
    return clone(row);
  };

  prisma.userBlock.deleteMany = async ({ where }) => {
    state.blocks = state.blocks.filter((item) => !(item.blockerUserId === where.blockerUserId && item.blockedUserId === where.blockedUserId));
  };

  prisma.networkPrivacySettings.findUnique = async ({ where }) => clone(state.networkPrivacySettings.find((item) => item.userId === where.userId) || null);
  prisma.networkPrivacySettings.upsert = async ({ where, create, update }) => {
    const existing = state.networkPrivacySettings.find((item) => item.userId === where.userId);
    if (existing) {
      Object.assign(existing, clone(update));
      return clone(existing);
    }
    const row = { id: `privacy-${state.networkPrivacySettings.length + 1}`, ...clone(create) };
    state.networkPrivacySettings.push(row);
    return clone(row);
  };

  prisma.notification.create = async ({ data }) => {
    const row = { id: `notification-${state.notifications.length + 1}`, createdAt: now(), ...clone(data) };
    state.notifications.push(row);
    return clone(row);
  };

  prisma.companyFollow.findUnique = async ({ where }) => clone(
    state.companyFollows.find((item) => item.userId === where.userId_organisationId.userId && item.organisationId === where.userId_organisationId.organisationId) || null,
  );
  prisma.companyFollow.upsert = async ({ where, create }) => {
    const existing = state.companyFollows.find((item) => item.userId === where.userId_organisationId.userId && item.organisationId === where.userId_organisationId.organisationId);
    if (existing) return clone(existing);
    const row = { id: `follow-${state.companyFollows.length + 1}`, createdAt: now(), ...clone(create) };
    state.companyFollows.push(row);
    return clone(row);
  };
  prisma.companyFollow.deleteMany = async ({ where }) => {
    state.companyFollows = state.companyFollows.filter((item) => !(item.userId === where.userId && item.organisationId === where.organisationId));
  };

  prisma.organisation.findUnique = async ({ where }) => clone(state.organisations.find((item) => item.id === where.id) || null);

  prisma.$transaction = async (callback) => callback(prisma);
});

test('network routes require authentication', async () => {
  const response = await request(app).get('/api/network/connections');
  assert.equal(response.status, 401);
});

test('candidate can send an idempotent connection request to a recruiter', async () => {
  const first = await request(app)
    .post('/api/network/requests')
    .set(authHeader('candidate-user-1'))
    .send({ targetUserId: 'recruiter-user-1', source: 'JOB' });

  const second = await request(app)
    .post('/api/network/requests')
    .set(authHeader('candidate-user-1'))
    .send({ targetUserId: 'recruiter-user-1', source: 'JOB' });

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(state.connections.filter((item) => item.pairKey === 'candidate-user-1:recruiter-user-1').length, 1);
  assert.equal(state.notifications.length, 1);
});

test('candidate to candidate connection lifecycle populates both networks and can be removed', async () => {
  const sendResponse = await request(app)
    .post('/api/network/requests')
    .set(authHeader('candidate-user-2'))
    .send({ targetUserId: 'candidate-user-1', source: 'PEOPLE_SEARCH' });

  assert.equal(sendResponse.status, 201);
  const requestId = state.connections.find((item) => item.pairKey === 'candidate-user-1:candidate-user-2')?.id;
  assert.ok(requestId);

  const acceptResponse = await request(app)
    .post(`/api/network/requests/${requestId}/accept`)
    .set(authHeader('candidate-user-1'));

  assert.equal(acceptResponse.status, 200);

  const [leftNetwork, rightNetwork] = await Promise.all([
    request(app).get('/api/network/connections').set(authHeader('candidate-user-1')),
    request(app).get('/api/network/connections').set(authHeader('candidate-user-2')),
  ]);

  assert.equal(leftNetwork.status, 200);
  assert.equal(rightNetwork.status, 200);
  assert.equal(leftNetwork.body.data.some((item) => item.profile.userId === 'candidate-user-2'), true);
  assert.equal(rightNetwork.body.data.some((item) => item.profile.userId === 'candidate-user-1'), true);

  const connectionId = state.connections.find((item) => item.pairKey === 'candidate-user-1:candidate-user-2')?.id;
  const removeResponse = await request(app)
    .delete(`/api/network/connections/${connectionId}`)
    .set(authHeader('candidate-user-2'));

  assert.equal(removeResponse.status, 200);
  assert.equal(state.connections.some((item) => item.pairKey === 'candidate-user-1:candidate-user-2'), false);
});

test('receiver can accept a connection request', async () => {
  state.connections.push({
    id: 'request-accept-1',
    requesterUserId: 'candidate-user-1',
    receiverUserId: 'recruiter-user-1',
    pairKey: 'candidate-user-1:recruiter-user-1',
    status: 'PENDING',
    source: 'PROFILE',
    createdAt: now(),
    updatedAt: now(),
    acceptedAt: null,
  });

  const response = await request(app)
    .post('/api/network/requests/request-accept-1/accept')
    .set(authHeader('recruiter-user-1'));

  assert.equal(response.status, 200);
  assert.equal(state.connections.find((item) => item.id === 'request-accept-1').status, 'ACCEPTED');
});

test('receiver can decline and requester can withdraw pending requests', async () => {
  state.connections.push({
    id: 'request-decline-1',
    requesterUserId: 'candidate-user-1',
    receiverUserId: 'recruiter-user-1',
    pairKey: 'candidate-user-1:recruiter-user-1',
    status: 'PENDING',
    source: 'PROFILE',
    createdAt: now(),
    updatedAt: now(),
    acceptedAt: null,
  });
  state.connections.push({
    id: 'request-withdraw-1',
    requesterUserId: 'candidate-user-2',
    receiverUserId: 'recruiter-user-1',
    pairKey: 'candidate-user-2:recruiter-user-1',
    status: 'PENDING',
    source: 'PROFILE',
    createdAt: now(),
    updatedAt: now(),
    acceptedAt: null,
  });

  const declineResponse = await request(app)
    .post('/api/network/requests/request-decline-1/decline')
    .set(authHeader('recruiter-user-1'));
  const withdrawResponse = await request(app)
    .delete('/api/network/requests/request-withdraw-1')
    .set(authHeader('candidate-user-2'));

  assert.equal(declineResponse.status, 200);
  assert.equal(withdrawResponse.status, 200);
  assert.equal(state.connections.find((item) => item.id === 'request-decline-1').status, 'DECLINED');
  assert.equal(state.connections.find((item) => item.id === 'request-withdraw-1').status, 'WITHDRAWN');
});

test('connected users can remove a connection', async () => {
  const response = await request(app)
    .delete('/api/network/connections/connection-accepted-1')
    .set(authHeader('candidate-user-1'));

  assert.equal(response.status, 200);
  assert.equal(state.connections.some((item) => item.id === 'connection-accepted-1'), false);
});

test('mutual connections are calculated between professionals', async () => {
  state.networkPrivacySettings = state.networkPrivacySettings.map((item) => (
    item.userId === 'candidate-user-2'
      ? { ...item, connectionVisibility: 'EVERYONE' }
      : item
  ));

  const response = await request(app)
    .get('/api/network/users/candidate-user-2/mutual')
    .set(authHeader('candidate-user-1'));

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.map((item) => item.userId), ['recruiter-user-2']);
});

test('blocking a user removes the connection and unblock restores availability', async () => {
  const blockResponse = await request(app)
    .post('/api/network/users/recruiter-user-2/block')
    .set(authHeader('candidate-user-1'));

  assert.equal(blockResponse.status, 200);
  assert.equal(state.blocks.length, 1);
  assert.equal(state.connections.some((item) => item.id === 'connection-accepted-1'), false);

  const unblockResponse = await request(app)
    .delete('/api/network/users/recruiter-user-2/block')
    .set(authHeader('candidate-user-1'));

  assert.equal(unblockResponse.status, 200);
  assert.equal(state.blocks.length, 0);
});

test('candidate search respects recruiter-only candidate privacy while recruiters can still discover them', async () => {
  const candidateView = await request(app)
    .get('/api/network/search')
    .set(authHeader('candidate-user-1'))
    .query({ q: 'Candidate Two' });

  const recruiterView = await request(app)
    .get('/api/network/search')
    .set(authHeader('recruiter-user-1'))
    .query({ q: 'Candidate Two' });

  assert.equal(candidateView.status, 200);
  assert.equal(candidateView.body.data.length, 0);
  assert.equal(recruiterView.status, 200);
  assert.equal(recruiterView.body.data[0].userId, 'candidate-user-2');
});

test('suggestions return explainable candidate and recruiter recommendations', async () => {
  const response = await request(app)
    .get('/api/network/suggestions')
    .set(authHeader('candidate-user-1'));

  assert.equal(response.status, 200);
  assert.ok(response.body.data.length >= 1);
  assert.equal(typeof response.body.data[0].reason, 'string');
});

test('recruiters can connect with other recruiters', async () => {
  const response = await request(app)
    .post('/api/network/requests')
    .set(authHeader('recruiter-user-1'))
    .send({ targetUserId: 'recruiter-user-2', source: 'PEOPLE_SEARCH' });

  assert.equal(response.status, 201);
  assert.equal(state.connections.some((item) => item.pairKey === 'recruiter-user-1:recruiter-user-2'), true);
});

test('reverse-direction duplicate requests keep a single valid relationship', async () => {
  const first = await request(app)
    .post('/api/network/requests')
    .set(authHeader('candidate-user-2'))
    .send({ targetUserId: 'recruiter-user-1', source: 'PROFILE' });

  const second = await request(app)
    .post('/api/network/requests')
    .set(authHeader('recruiter-user-1'))
    .send({ targetUserId: 'candidate-user-2', source: 'PROFILE' });

  assert.equal(first.status, 201);
  assert.equal(second.status, 409);
  assert.equal(state.connections.filter((item) => item.pairKey === 'candidate-user-2:recruiter-user-1').length, 1);
  assert.equal(state.connections.find((item) => item.pairKey === 'candidate-user-2:recruiter-user-1')?.status, 'PENDING');
});

test('connection request route is throttled by the rate limiter', async () => {
  const responses = await Promise.all([
    request(app).post('/api/network/requests').set(authHeader('candidate-user-1')).send({ targetUserId: 'recruiter-user-1', source: 'PROFILE' }),
    request(app).post('/api/network/requests').set(authHeader('candidate-user-1')).send({ targetUserId: 'candidate-user-2', source: 'PROFILE' }),
    request(app).post('/api/network/requests').set(authHeader('candidate-user-1')).send({ targetUserId: 'recruiter-user-2', source: 'PROFILE' }),
  ]);

  assert.equal(responses[2].status, 429);
});
