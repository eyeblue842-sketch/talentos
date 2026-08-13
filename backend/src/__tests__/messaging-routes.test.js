import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.MESSAGE_SEND_RATE_LIMIT = '2';
process.env.MESSAGE_SEND_WINDOW_MINUTES = '60';

let app;
let prisma;
let signToken;
let state;
let resetRateLimiterBuckets;

function now() {
  return new Date('2026-08-12T12:00:00.000Z');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function authHeader(userId) {
  return { Authorization: `Bearer ${signToken({ userId, sessionVersion: 0 })}` };
}

function buildPdfBuffer() {
  return Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF', 'utf8');
}

function withUserRelations(user) {
  const recruiterProfile = state.recruiterProfiles.find((item) => item.userId === user.id) || null;
  return {
    ...clone(user),
    activeMembership: recruiterProfile ? { organisationId: recruiterProfile.organisationId } : null,
    candidateProfile: clone(state.candidateProfiles.find((item) => item.userId === user.id) || null),
    recruiterProfile: recruiterProfile ? {
      ...clone(recruiterProfile),
      organisation: clone(state.organisations.find((item) => item.id === recruiterProfile.organisationId) || null),
    } : null,
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
        headline: 'Java engineer',
        currentTitle: 'Software Engineer',
        currentDesignation: 'Software Engineer',
        currentEmployer: 'Acme Labs',
        location: 'Bengaluru',
        profileImageUrl: null,
      },
      {
        id: 'candidate-2',
        userId: 'candidate-user-2',
        fullName: 'Candidate Two',
        headline: 'Data engineer',
        currentTitle: 'Data Engineer',
        currentDesignation: 'Data Engineer',
        currentEmployer: 'Stealth Data',
        location: 'Pune',
        profileImageUrl: null,
      },
    ],
    recruiterProfiles: [
      {
        id: 'recruiter-profile-1',
        userId: 'recruiter-user-1',
        organisationId: 'org-1',
        companyName: 'Acme Labs',
        designation: 'Senior Talent Acquisition Manager',
        industryDomain: 'FinTech',
        headquartersLocation: 'Bengaluru',
      },
      {
        id: 'recruiter-profile-2',
        userId: 'recruiter-user-2',
        organisationId: 'org-1',
        companyName: 'Acme Labs',
        designation: 'Lead Recruiter',
        industryDomain: 'FinTech',
        headquartersLocation: 'Bengaluru',
      },
    ],
    organisations: [
      { id: 'org-1', name: 'Acme Labs', slug: 'acme-labs', status: 'ACTIVE', headquarters: 'Bengaluru' },
    ],
    connections: [
      {
        id: 'connection-1',
        requesterUserId: 'candidate-user-1',
        receiverUserId: 'recruiter-user-1',
        pairKey: 'candidate-user-1:recruiter-user-1',
        status: 'ACCEPTED',
        source: 'PROFILE',
        createdAt: now(),
        updatedAt: now(),
        acceptedAt: now(),
      },
      {
        id: 'connection-2',
        requesterUserId: 'candidate-user-1',
        receiverUserId: 'candidate-user-2',
        pairKey: 'candidate-user-1:candidate-user-2',
        status: 'ACCEPTED',
        source: 'PROFILE',
        createdAt: now(),
        updatedAt: now(),
        acceptedAt: now(),
      },
    ],
    blocks: [],
    notifications: [],
    conversations: [],
    messages: [],
  };
}

before(async () => {
  ({ app } = await import('../app.js'));
  ({ prisma } = await import('../config/db.js'));
  ({ signToken } = await import('../utils/jwt.js'));
  ({ resetRateLimiterBuckets } = await import('../middleware/rateLimit.js'));
});

beforeEach(() => {
  seedState();
  resetRateLimiterBuckets();

  prisma.organisationMembership.findMany = async () => [];

  prisma.user.findUnique = async ({ where }) => {
    const user = state.users.find((item) => item.id === where.id) || null;
    return user ? withUserRelations(user) : null;
  };

  prisma.userBlock.findFirst = async ({ where = {} } = {}) => {
    const row = state.blocks.find((item) => where.OR.some((clause) => clause.blockerUserId === item.blockerUserId && clause.blockedUserId === item.blockedUserId)) || null;
    return row ? clone(row) : null;
  };

  prisma.userConnection.findUnique = async ({ where }) => {
    const row = state.connections.find((item) => (
      (where.id && item.id === where.id) || (where.pairKey && item.pairKey === where.pairKey)
    )) || null;
    return row ? clone(row) : null;
  };

  prisma.directConversation.upsert = async ({ where, create, include }) => {
    let row = state.conversations.find((item) => item.pairKey === where.pairKey);
    if (!row) {
      row = {
        id: `conversation-${state.conversations.length + 1}`,
        createdAt: now(),
        updatedAt: now(),
        lastMessageAt: null,
        lastMessagePreview: null,
        participantALastReadAt: null,
        participantBLastReadAt: null,
        participantAUnreadCount: 0,
        participantBUnreadCount: 0,
        ...clone(create),
      };
      state.conversations.push(row);
    }
    return {
      ...clone(row),
      participantAUser: include?.participantAUser ? withUserRelations(state.users.find((item) => item.id === row.participantAUserId)) : undefined,
      participantBUser: include?.participantBUser ? withUserRelations(state.users.find((item) => item.id === row.participantBUserId)) : undefined,
    };
  };

  prisma.directConversation.findMany = async ({ where = {}, include, orderBy, skip = 0, take } = {}) => {
    let rows = state.conversations.filter((item) => {
      const actorMatch = where.AND?.[0]?.OR?.some((clause) => (
        (clause.participantAUserId && clause.participantAUserId === item.participantAUserId)
        || (clause.participantBUserId && clause.participantBUserId === item.participantBUserId)
      )) ?? true;
      return actorMatch;
    });
    rows = rows.slice(skip, take ? skip + take : undefined);
    return rows.map((row) => ({
      ...clone(row),
      participantAUser: include?.participantAUser ? withUserRelations(state.users.find((item) => item.id === row.participantAUserId)) : undefined,
      participantBUser: include?.participantBUser ? withUserRelations(state.users.find((item) => item.id === row.participantBUserId)) : undefined,
    }));
  };

  prisma.directConversation.count = async ({ where = {} } = {}) => (
    state.conversations.filter((item) => where.AND?.[0]?.OR?.some((clause) => (
      (clause.participantAUserId && clause.participantAUserId === item.participantAUserId)
      || (clause.participantBUserId && clause.participantBUserId === item.participantBUserId)
    )) ?? true).length
  );

  prisma.directConversation.findFirst = async ({ where = {}, include, select } = {}) => {
    const row = state.conversations.find((item) => (
      (!where.id || item.id === where.id)
      && (!where.OR || where.OR.some((clause) => (
        (clause.participantAUserId && clause.participantAUserId === item.participantAUserId)
        || (clause.participantBUserId && clause.participantBUserId === item.participantBUserId)
      )))
    )) || null;
    if (!row) return null;
    if (select) return clone(row);
    return {
      ...clone(row),
      participantAUser: include?.participantAUser ? withUserRelations(state.users.find((item) => item.id === row.participantAUserId)) : undefined,
      participantBUser: include?.participantBUser ? withUserRelations(state.users.find((item) => item.id === row.participantBUserId)) : undefined,
    };
  };

  prisma.directConversation.update = async ({ where, data }) => {
    const row = state.conversations.find((item) => item.id === where.id);
    for (const [key, value] of Object.entries(clone(data))) {
      if (value && typeof value === 'object' && 'increment' in value) {
        row[key] = (row[key] || 0) + Number(value.increment || 0);
      } else {
        row[key] = value;
      }
    }
    row.updatedAt = now();
    return clone(row);
  };

  prisma.directConversation.aggregate = async () => ({
    _sum: {
      participantAUnreadCount: state.conversations.reduce((sum, item) => sum + item.participantAUnreadCount, 0),
      participantBUnreadCount: state.conversations.reduce((sum, item) => sum + item.participantBUnreadCount, 0),
    },
  });

  prisma.directMessage.findMany = async ({ where = {}, cursor, skip = 0, take } = {}) => {
    let rows = state.messages.filter((item) => item.conversationId === where.conversationId);
    rows = rows.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    if (cursor?.id) {
      const index = rows.findIndex((item) => item.id === cursor.id);
      if (index >= 0) rows = rows.slice(index + skip);
    } else if (skip) {
      rows = rows.slice(skip);
    }
    if (take) rows = rows.slice(0, take);
    return rows.map(clone);
  };

  prisma.directMessage.findFirst = async ({ where = {}, include } = {}) => {
    const row = state.messages.find((item) => item.id === where.id && (!where.conversationId || item.conversationId === where.conversationId)) || null;
    if (!row) return null;
    return {
      ...clone(row),
      conversation: include?.conversation ? clone(state.conversations.find((item) => item.id === row.conversationId) || null) : undefined,
    };
  };

  prisma.directMessage.create = async ({ data }) => {
    const row = {
      id: `message-${state.messages.length + 1}`,
      createdAt: now(),
      updatedAt: now(),
      editedAt: null,
      deletedAt: null,
      ...clone(data),
    };
    state.messages.push(row);
    return clone(row);
  };

  prisma.notification.create = async ({ data }) => {
    const row = { id: `notification-${state.notifications.length + 1}`, createdAt: now(), ...clone(data) };
    state.notifications.push(row);
    return clone(row);
  };

  prisma.$transaction = async (callback) => callback(prisma);
});

test('messaging routes require authentication', async () => {
  const response = await request(app).get('/api/messages/conversations');
  assert.equal(response.status, 401);
});

test('connected users can create one direct conversation idempotently', async () => {
  const first = await request(app)
    .post('/api/messages/conversations')
    .set(authHeader('candidate-user-1'))
    .send({ participantUserId: 'recruiter-user-1' });

  const second = await request(app)
    .post('/api/messages/conversations')
    .set(authHeader('candidate-user-1'))
    .send({ participantUserId: 'recruiter-user-1' });

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(state.conversations.length, 1);
});

test('connected users can send messages and recipient unread count increments', async () => {
  await request(app)
    .post('/api/messages/conversations')
    .set(authHeader('candidate-user-1'))
    .send({ participantUserId: 'recruiter-user-1' });

  const conversationId = state.conversations[0].id;
  const response = await request(app)
    .post(`/api/messages/conversations/${conversationId}/messages`)
    .set(authHeader('candidate-user-1'))
    .field('content', 'Hello Anita');

  assert.equal(response.status, 201);
  assert.equal(state.messages.length, 1);
  assert.equal(state.conversations[0].participantBUnreadCount, 1);
  assert.equal(state.notifications.length, 1);
});

test('blocked users cannot create or continue conversations', async () => {
  state.blocks.push({
    id: 'block-1',
    blockerUserId: 'recruiter-user-1',
    blockedUserId: 'candidate-user-1',
    createdAt: now(),
  });

  const createResponse = await request(app)
    .post('/api/messages/conversations')
    .set(authHeader('candidate-user-1'))
    .send({ participantUserId: 'recruiter-user-1' });

  assert.equal(createResponse.status, 403);
});

test('removed connections keep history but disable new sends', async () => {
  await request(app)
    .post('/api/messages/conversations')
    .set(authHeader('candidate-user-1'))
    .send({ participantUserId: 'candidate-user-2' });

  const conversationId = state.conversations[0].id;
  await request(app)
    .post(`/api/messages/conversations/${conversationId}/messages`)
    .set(authHeader('candidate-user-1'))
    .field('content', 'Hello there');

  state.connections = state.connections.filter((item) => item.pairKey !== 'candidate-user-1:candidate-user-2');

  const conversationResponse = await request(app)
    .get(`/api/messages/conversations/${conversationId}`)
    .set(authHeader('candidate-user-1'));
  const sendResponse = await request(app)
    .post(`/api/messages/conversations/${conversationId}/messages`)
    .set(authHeader('candidate-user-1'))
    .field('content', 'Another message');

  assert.equal(conversationResponse.status, 200);
  assert.equal(conversationResponse.body.data.canSend, false);
  assert.equal(sendResponse.status, 403);
  assert.equal(state.messages.length, 1);
});

test('reading a conversation clears unread count for the current participant', async () => {
  await request(app)
    .post('/api/messages/conversations')
    .set(authHeader('candidate-user-1'))
    .send({ participantUserId: 'recruiter-user-1' });

  const conversationId = state.conversations[0].id;
  await request(app)
    .post(`/api/messages/conversations/${conversationId}/messages`)
    .set(authHeader('candidate-user-1'))
    .field('content', 'Hello Anita');

  const readResponse = await request(app)
    .post(`/api/messages/conversations/${conversationId}/read`)
    .set(authHeader('recruiter-user-1'))
    .send({ lastReadMessageId: 'message-1' });

  const unreadResponse = await request(app)
    .get('/api/messages/unread-count')
    .set(authHeader('recruiter-user-1'));

  assert.equal(readResponse.status, 200);
  assert.equal(state.conversations[0].participantBUnreadCount, 0);
  assert.equal(unreadResponse.status, 200);
  assert.equal(unreadResponse.body.data.unreadCount, 0);
});

test('permitted attachment uploads are accepted and can be downloaded by a participant', async () => {
  await request(app)
    .post('/api/messages/conversations')
    .set(authHeader('candidate-user-1'))
    .send({ participantUserId: 'recruiter-user-1' });

  const conversationId = state.conversations[0].id;
  const sendResponse = await request(app)
    .post(`/api/messages/conversations/${conversationId}/messages`)
    .set(authHeader('candidate-user-1'))
    .attach('attachment', buildPdfBuffer(), { filename: 'intro.pdf', contentType: 'application/pdf' });

  assert.equal(sendResponse.status, 201);
  assert.equal(state.messages[0].type, 'FILE');
  assert.equal(Boolean(state.messages[0].attachmentStorageKey), true);

  const downloadResponse = await request(app)
    .get(`/api/messages/attachments/${state.messages[0].id}`)
    .set(authHeader('recruiter-user-1'));

  assert.equal(downloadResponse.status, 200);
  assert.equal(downloadResponse.headers['content-type'], 'application/pdf');
});

test('executable or invalid attachment types are rejected', async () => {
  await request(app)
    .post('/api/messages/conversations')
    .set(authHeader('candidate-user-1'))
    .send({ participantUserId: 'recruiter-user-1' });

  const conversationId = state.conversations[0].id;
  const response = await request(app)
    .post(`/api/messages/conversations/${conversationId}/messages`)
    .set(authHeader('candidate-user-1'))
    .attach('attachment', Buffer.from('MZfakeexe', 'utf8'), { filename: 'malware.exe', contentType: 'application/x-msdownload' });

  assert.equal(response.status, 422);
});

test('invalid mime/type mismatches are rejected', async () => {
  await request(app)
    .post('/api/messages/conversations')
    .set(authHeader('candidate-user-1'))
    .send({ participantUserId: 'recruiter-user-1' });

  const conversationId = state.conversations[0].id;
  const response = await request(app)
    .post(`/api/messages/conversations/${conversationId}/messages`)
    .set(authHeader('candidate-user-1'))
    .attach('attachment', buildPdfBuffer(), { filename: 'intro.pdf', contentType: 'application/x-msdownload' });

  assert.equal(response.status, 422);
});

test('oversized attachments are rejected', async () => {
  await request(app)
    .post('/api/messages/conversations')
    .set(authHeader('candidate-user-1'))
    .send({ participantUserId: 'recruiter-user-1' });

  const conversationId = state.conversations[0].id;
  const response = await request(app)
    .post(`/api/messages/conversations/${conversationId}/messages`)
    .set(authHeader('candidate-user-1'))
    .attach('attachment', Buffer.alloc(11 * 1024 * 1024, 1), { filename: 'huge.pdf', contentType: 'application/pdf' });

  assert.equal(response.status, 413);
});

test('unauthorized users cannot read another user conversation or send into it', async () => {
  await request(app)
    .post('/api/messages/conversations')
    .set(authHeader('candidate-user-1'))
    .send({ participantUserId: 'recruiter-user-1' });

  const conversationId = state.conversations[0].id;
  const readResponse = await request(app)
    .get(`/api/messages/conversations/${conversationId}`)
    .set(authHeader('recruiter-user-2'));
  const sendResponse = await request(app)
    .post(`/api/messages/conversations/${conversationId}/messages`)
    .set(authHeader('recruiter-user-2'))
    .field('content', 'Unauthorized');

  assert.equal(readResponse.status, 404);
  assert.equal(sendResponse.status, 404);
});

test('pending connections cannot start messaging', async () => {
  state.connections.push({
    id: 'connection-pending-1',
    requesterUserId: 'candidate-user-2',
    receiverUserId: 'recruiter-user-2',
    pairKey: 'candidate-user-2:recruiter-user-2',
    status: 'PENDING',
    source: 'PROFILE',
    createdAt: now(),
    updatedAt: now(),
    acceptedAt: null,
  });

  const response = await request(app)
    .post('/api/messages/conversations')
    .set(authHeader('candidate-user-2'))
    .send({ participantUserId: 'recruiter-user-2' });

  assert.equal(response.status, 403);
});

test('sender identity cannot be spoofed through request payload fields', async () => {
  await request(app)
    .post('/api/messages/conversations')
    .set(authHeader('candidate-user-1'))
    .send({ participantUserId: 'recruiter-user-1' });

  const conversationId = state.conversations[0].id;
  const response = await request(app)
    .post(`/api/messages/conversations/${conversationId}/messages`)
    .set(authHeader('candidate-user-1'))
    .field('content', 'Hello')
    .field('senderUserId', 'recruiter-user-1');

  assert.equal(response.status, 201);
  assert.equal(state.messages[0].senderUserId, 'candidate-user-1');
});

test('blocked or disconnected users cannot send attachments', async () => {
  await request(app)
    .post('/api/messages/conversations')
    .set(authHeader('candidate-user-1'))
    .send({ participantUserId: 'recruiter-user-1' });

  const conversationId = state.conversations[0].id;
  state.blocks.push({
    id: 'block-2',
    blockerUserId: 'recruiter-user-1',
    blockedUserId: 'candidate-user-1',
    createdAt: now(),
  });

  const blockedResponse = await request(app)
    .post(`/api/messages/conversations/${conversationId}/messages`)
    .set(authHeader('candidate-user-1'))
    .attach('attachment', buildPdfBuffer(), { filename: 'intro.pdf', contentType: 'application/pdf' });

  assert.equal(blockedResponse.status, 403);

  state.blocks = [];
  state.connections = state.connections.filter((item) => item.pairKey !== 'candidate-user-1:recruiter-user-1');

  const disconnectedResponse = await request(app)
    .post(`/api/messages/conversations/${conversationId}/messages`)
    .set(authHeader('candidate-user-1'))
    .attach('attachment', buildPdfBuffer(), { filename: 'intro.pdf', contentType: 'application/pdf' });

  assert.equal(disconnectedResponse.status, 403);
});

test('attachment access is authorization scoped and missing attachments fail safely', async () => {
  await request(app)
    .post('/api/messages/conversations')
    .set(authHeader('candidate-user-1'))
    .send({ participantUserId: 'recruiter-user-1' });

  const conversationId = state.conversations[0].id;
  await request(app)
    .post(`/api/messages/conversations/${conversationId}/messages`)
    .set(authHeader('candidate-user-1'))
    .attach('attachment', buildPdfBuffer(), { filename: 'intro.pdf', contentType: 'application/pdf' });

  const messageId = state.messages[0].id;
  const unauthorizedResponse = await request(app)
    .get(`/api/messages/attachments/${messageId}`)
    .set(authHeader('recruiter-user-2'));
  const missingResponse = await request(app)
    .get('/api/messages/attachments/missing-message')
    .set(authHeader('candidate-user-1'));

  assert.equal(unauthorizedResponse.status, 404);
  assert.equal(missingResponse.status, 404);

  const originalStorageKey = state.messages[0].attachmentStorageKey;
  state.messages[0].attachmentStorageKey = 'messages/does-not-exist.pdf';

  const deletedResponse = await request(app)
    .get(`/api/messages/attachments/${messageId}`)
    .set(authHeader('candidate-user-1'));

  assert.equal(deletedResponse.status, 404);
  state.messages[0].attachmentStorageKey = originalStorageKey;
});

test('message sending is throttled by the messaging rate limiter', async () => {
  await request(app)
    .post('/api/messages/conversations')
    .set(authHeader('candidate-user-1'))
    .send({ participantUserId: 'recruiter-user-1' });

  const conversationId = state.conversations[0].id;
  const first = await request(app)
    .post(`/api/messages/conversations/${conversationId}/messages`)
    .set(authHeader('candidate-user-1'))
    .field('content', 'One');
  const second = await request(app)
    .post(`/api/messages/conversations/${conversationId}/messages`)
    .set(authHeader('candidate-user-1'))
    .field('content', 'Two');
  const third = await request(app)
    .post(`/api/messages/conversations/${conversationId}/messages`)
    .set(authHeader('candidate-user-1'))
    .field('content', 'Three');

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(third.status, 429);
});
