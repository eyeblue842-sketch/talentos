import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePublishWindow } from '../services/jobService.js';

const NOW = new Date('2026-09-16T09:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

test('first publication with no deadline defaults to firstPublishedAt + 31 days', () => {
  const window = resolvePublishWindow({ activatedAt: null, applicationOpensAt: null, applicationDeadline: null }, NOW);

  assert.equal(window.activatedAt.toISOString(), NOW.toISOString());
  assert.equal(window.applicationOpensAt.toISOString(), NOW.toISOString());
  // 16 Sep 2026 + 31 days = 17 Oct 2026 (matches the spec example).
  assert.equal(window.applicationDeadline.toISOString(), new Date('2026-10-17T09:00:00.000Z').toISOString());
  assert.equal(window.activeUntil.toISOString(), window.applicationDeadline.toISOString());
});

test('recruiter may choose an earlier deadline within the 31-day window', () => {
  const chosen = new Date(NOW.getTime() + 10 * DAY);
  const window = resolvePublishWindow({ activatedAt: null, applicationDeadline: chosen.toISOString() }, NOW);

  assert.equal(window.applicationDeadline.toISOString(), chosen.toISOString());
  assert.equal(window.activeUntil.toISOString(), chosen.toISOString());
});

test('first publication date is preserved across a later republish', () => {
  const firstPublishedAt = new Date('2026-09-01T09:00:00.000Z');
  const later = new Date('2026-09-20T09:00:00.000Z');
  const window = resolvePublishWindow({ activatedAt: firstPublishedAt, applicationDeadline: null }, later);

  // activatedAt stays at the first publication, and the default deadline is
  // anchored to it (1 Sep + 31 days = 2 Oct), NOT to the republish date.
  assert.equal(window.activatedAt.toISOString(), firstPublishedAt.toISOString());
  assert.equal(window.applicationDeadline.toISOString(), new Date('2026-10-02T09:00:00.000Z').toISOString());
});

test('a past deadline is rejected', () => {
  assert.throws(
    () => resolvePublishWindow({ activatedAt: null, applicationDeadline: new Date(NOW.getTime() - DAY).toISOString() }, NOW),
    (error) => error.code === 'DEADLINE_IN_PAST' && error.statusCode === 422,
  );
});

test('a deadline later than 31 days from first publication is rejected', () => {
  assert.throws(
    () => resolvePublishWindow({ activatedAt: null, applicationDeadline: new Date(NOW.getTime() + 45 * DAY).toISOString() }, NOW),
    (error) => error.code === 'DEADLINE_TOO_LATE' && error.statusCode === 422,
  );
});
