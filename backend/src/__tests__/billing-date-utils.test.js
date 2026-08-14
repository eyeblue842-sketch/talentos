import test from 'node:test';
import assert from 'node:assert/strict';
import { addCalendarMonths, addDays } from '../utils/dateUtils.js';

function iso(date) {
  return date.toISOString().slice(0, 10);
}

test('addCalendarMonths clamps to the last day of the target month when the anchor day does not exist there', () => {
  // 31 Jan + 1 month -> 28 Feb 2026 (not a leap year)
  assert.equal(iso(addCalendarMonths(new Date('2026-01-31T00:00:00.000Z'), 1)), '2026-02-28');
  // 31 Jan + 1 month -> 29 Feb 2028 (leap year)
  assert.equal(iso(addCalendarMonths(new Date('2028-01-31T00:00:00.000Z'), 1)), '2028-02-29');
  // 31 Aug + 6 months -> 28 Feb 2027 (six-month ATS_DB_6M plan bought in August)
  assert.equal(iso(addCalendarMonths(new Date('2026-08-31T00:00:00.000Z'), 6)), '2027-02-28');
});

test('addCalendarMonths preserves the anchor day for ordinary months', () => {
  assert.equal(iso(addCalendarMonths(new Date('2026-08-14T00:00:00.000Z'), 1)), '2026-09-14');
  assert.equal(iso(addCalendarMonths(new Date('2026-08-14T00:00:00.000Z'), 6)), '2027-02-14');
  assert.equal(iso(addCalendarMonths(new Date('2026-08-14T00:00:00.000Z'), 12)), '2027-08-14');
});

test('addCalendarMonths handles the annual (12-month) case landing back on 31 Jan the following year', () => {
  assert.equal(iso(addCalendarMonths(new Date('2026-01-31T00:00:00.000Z'), 12)), '2027-01-31');
});

test('addDays adds exactly 45*24h for job active-window math and is not affected by month boundaries', () => {
  const activatedAt = new Date('2026-08-14T10:00:00.000Z');
  const activeUntil = addDays(activatedAt, 45);
  assert.equal(activeUntil.getTime() - activatedAt.getTime(), 45 * 24 * 60 * 60 * 1000);
  assert.equal(activeUntil.toISOString(), '2026-09-28T10:00:00.000Z');
});
