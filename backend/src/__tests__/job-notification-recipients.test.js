import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNotificationRecipients, resolveActiveNotificationRecipients } from '../services/jobService.js';

// Minimal mock client: active members of org-1 are the recruiter, an owner,
// and a hiring manager. Casing is intentionally mixed to prove canonical
// casing + case-insensitive matching/dedup.
function mockClient(members = [
  { email: 'Recruiter@Acme.com' },
  { email: 'owner@acme.com' },
  { email: 'HM@acme.com' },
]) {
  return {
    organisationMembership: {
      findMany: async () => members.map((user) => ({ user })),
    },
  };
}

const actor = { id: 'recruiter-1', email: 'recruiter@acme.com' };

test('primary defaults to the actor org email and additional members are accepted', async () => {
  const result = await buildNotificationRecipients(mockClient(), {
    organisationId: 'org-1',
    actorUser: actor,
    primary: undefined,
    additional: ['owner@acme.com'],
    defaultPrimaryToActor: true,
  });

  assert.equal(result.primary, 'Recruiter@Acme.com'); // canonical member casing
  assert.deepEqual(result.additional, ['owner@acme.com']);
});

test('arbitrary external addresses are rejected for primary and additional', async () => {
  await assert.rejects(
    () => buildNotificationRecipients(mockClient(), {
      organisationId: 'org-1', actorUser: actor, primary: 'randomperson@gmail.com',
    }),
    (error) => error.code === 'RECEIVING_EMAIL_NOT_AUTHORISED' && error.statusCode === 422,
  );

  await assert.rejects(
    () => buildNotificationRecipients(mockClient(), {
      organisationId: 'org-1', actorUser: actor, primary: 'owner@acme.com', additional: ['randomperson@gmail.com'],
    }),
    (error) => error.code === 'RECEIVING_EMAIL_NOT_AUTHORISED',
  );
});

test('additional recipients are de-duplicated case-insensitively and never duplicate the primary', async () => {
  const result = await buildNotificationRecipients(mockClient(), {
    organisationId: 'org-1',
    actorUser: actor,
    primary: 'owner@acme.com',
    additional: ['OWNER@acme.com', 'hm@acme.com', 'HM@ACME.COM', 'recruiter@acme.com'],
  });

  assert.equal(result.primary, 'owner@acme.com');
  // OWNER == primary (dropped); HM appears once; recruiter kept once.
  assert.deepEqual(result.additional.map((e) => e.toLowerCase()).sort(), ['hm@acme.com', 'recruiter@acme.com']);
});

test('publishing requires a primary receiving email', async () => {
  await assert.rejects(
    () => buildNotificationRecipients(mockClient([]), {
      organisationId: 'org-1', actorUser: { id: 'x' }, primary: null, requirePrimary: true, defaultPrimaryToActor: true,
    }),
    (error) => error.code === 'RECEIVING_EMAIL_REQUIRED' && error.statusCode === 422,
  );
});

test('send-time resolution excludes recipients who lost org access and de-duplicates', async () => {
  // At send time only owner + recruiter remain active members; the stored
  // additional "former@acme.com" is no longer a member and must be excluded.
  const client = mockClient([{ email: 'recruiter@acme.com' }, { email: 'owner@acme.com' }]);
  const recipients = await resolveActiveNotificationRecipients(
    'org-1',
    { primary: 'recruiter@acme.com', additional: ['owner@acme.com', 'former@acme.com', 'RECRUITER@acme.com'] },
    client,
  );

  assert.deepEqual(recipients.map((e) => e.toLowerCase()), ['recruiter@acme.com', 'owner@acme.com']);
});

test('send-time resolution returns empty for a missing organisation', async () => {
  const recipients = await resolveActiveNotificationRecipients(null, { primary: 'x@acme.com' }, mockClient());
  assert.deepEqual(recipients, []);
});
