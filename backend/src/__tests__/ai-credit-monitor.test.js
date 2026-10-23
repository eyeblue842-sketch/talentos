import assert from 'node:assert/strict';
import test from 'node:test';
import { isOutOfCredits } from '../services/aiCreditMonitor.js';

test('only an exhausted-credit failure counts as out of credits', () => {
  assert.equal(isOutOfCredits({ healthy: false, code: 'credit_balance_exhausted' }), true);
  assert.equal(isOutOfCredits({ healthy: false, errorType: 'insufficient_quota' }), true);
  assert.equal(isOutOfCredits({ healthy: false, code: 'model_not_found' }), false);
  assert.equal(isOutOfCredits({ healthy: true }), false);
  assert.equal(isOutOfCredits(null), false);
});
