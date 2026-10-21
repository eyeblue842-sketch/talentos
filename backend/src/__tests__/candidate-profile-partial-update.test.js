import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateProfileUpdateSchema } from '@careeriz/shared';

test('a partial profile update leaves omitted fields untouched (saving skills must not wipe headline/title/employer/location/phone)', () => {
  const parsed = candidateProfileUpdateSchema.parse({ skills: ['Node.js', 'AWS'] });
  assert.deepEqual(parsed, { skills: ['Node.js', 'AWS'] });
  for (const field of ['headline', 'currentTitle', 'currentEmployer', 'currentDesignation', 'location', 'phoneNumber']) {
    assert.equal(Object.prototype.hasOwnProperty.call(parsed, field), false, `${field} must not appear when it was not sent`);
  }
});

test('an explicitly empty value still clears the field', () => {
  const parsed = candidateProfileUpdateSchema.parse({ headline: '', phoneNumber: '   ' });
  assert.equal(parsed.headline, null);
  assert.equal(parsed.phoneNumber, null);
});
