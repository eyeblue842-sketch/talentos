import { describe, expect, it } from 'vitest';
import { formatPaise, formatBillingDate, daysRemaining, purchaseStatusLabel, subscriptionStatusLabel } from '@/lib/billing-format';

describe('formatPaise', () => {
  it('formats every spec price exactly as INR with Indian digit grouping', () => {
    expect(formatPaise(177000)).toBe('₹1,770');
    expect(formatPaise(1180000)).toBe('₹11,800');
    expect(formatPaise(5900000)).toBe('₹59,000');
    expect(formatPaise(11800000)).toBe('₹1,18,000');
  });

  it('formats the GST and base components correctly', () => {
    expect(formatPaise(150000)).toBe('₹1,500');
    expect(formatPaise(27000)).toBe('₹270');
    expect(formatPaise(1000000)).toBe('₹10,000');
    expect(formatPaise(180000)).toBe('₹1,800');
    expect(formatPaise(5000000)).toBe('₹50,000');
    expect(formatPaise(900000)).toBe('₹9,000');
    expect(formatPaise(10000000)).toBe('₹1,00,000');
    expect(formatPaise(1800000)).toBe('₹18,000');
  });

  it('handles null/undefined/NaN gracefully as zero', () => {
    expect(formatPaise(null)).toBe('₹0');
    expect(formatPaise(undefined)).toBe('₹0');
    expect(formatPaise('not-a-number')).toBe('₹0');
  });
});

describe('daysRemaining', () => {
  it('returns null when there is no expiry date', () => {
    expect(daysRemaining(null)).toBeNull();
  });

  it('never returns a negative number for an already-expired date', () => {
    expect(daysRemaining(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString())).toBe(0);
  });

  it('rounds up to a whole day for a future date', () => {
    const inTenDays = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 5000).toISOString();
    expect(daysRemaining(inTenDays)).toBe(11);
  });
});

describe('formatBillingDate', () => {
  it('formats a valid date and falls back for missing/invalid input', () => {
    expect(formatBillingDate('2026-08-14T00:00:00.000Z')).toMatch(/14 Aug 2026/);
    expect(formatBillingDate(null)).toBe('Not available');
    expect(formatBillingDate('not-a-date')).toBe('Not available');
  });
});

describe('status labels', () => {
  it('maps every PurchaseStatus value to a human label', () => {
    for (const status of ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED']) {
      expect(purchaseStatusLabel(status)).not.toBe(status);
    }
  });

  it('maps every SubscriptionStatus value to a human label', () => {
    for (const status of ['PENDING_PAYMENT', 'ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'CANCELLED', 'PAYMENT_FAILED', 'REFUNDED', 'SUSPENDED']) {
      expect(subscriptionStatusLabel(status)).not.toBe(status);
    }
  });
});
