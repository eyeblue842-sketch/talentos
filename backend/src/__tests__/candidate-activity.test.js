import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../config/db.js';
import { touchCandidateLastActive } from '../services/candidateActivityService.js';

test('candidate activity updates lastActiveAt through the profile delegate', async () => {
  const previousUpdate = prisma.candidateProfile.update;
  const calls = [];
  prisma.candidateProfile.update = async (args) => {
    calls.push(args);
    return { id: args.where.id, lastActiveAt: args.data.lastActiveAt };
  };

  try {
    const at = new Date('2026-08-07T10:00:00.000Z');
    assert.equal(await touchCandidateLastActive('candidate-1', at), true);
    assert.deepEqual(calls, [{
      where: { id: 'candidate-1' },
      data: { lastActiveAt: at },
    }]);
  } finally {
    prisma.candidateProfile.update = previousUpdate;
  }
});
