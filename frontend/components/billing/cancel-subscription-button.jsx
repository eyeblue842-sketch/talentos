"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { formatBillingDate } from '@/lib/billing-format';

async function postJson(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message || 'Request failed.');
  }
  return body.data;
}

// Wording is deliberately explicit that this stops renewal only - it must
// not read like an immediate cutoff. Suspension (policy/dispute) and
// refunds are separate, admin-triggered actions with their own distinct
// language elsewhere in the dashboard; natural expiry is just the date
// passing with no action taken at all (B1 hardening, section 6).
export function CancelSubscriptionButton({ expiresAt }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState(null);

  async function handleConfirm() {
    if (reason.trim().length < 5) {
      setErrorMessage('Please provide a short reason (at least 5 characters).');
      return;
    }
    setStatus('cancelling');
    setErrorMessage(null);
    try {
      await postJson('/api/billing/subscription/cancel', { reason: reason.trim() });
      setStatus('cancelled');
      router.refresh();
    } catch (error) {
      setStatus('idle');
      setErrorMessage(error?.message || 'Could not cancel renewal.');
    }
  }

  if (!confirming) {
    return (
      <div>
        <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
          Cancel renewal
        </Button>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          Stops future renewal only. Your current plan and any unused included job-posting credits stay active until{' '}
          {formatBillingDate(expiresAt)}. This is not an immediate cancellation, and no refund is issued.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] p-4">
      <p className="text-sm text-[var(--color-text-secondary)]">
        This stops your plan from renewing after {formatBillingDate(expiresAt)}. You keep full access - including any
        unused included job-posting credits - until then. No refund is issued for the time already paid for.
      </p>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium text-[var(--color-text)]">Reason for cancelling renewal</span>
        <input
          type="text"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-3 py-2 text-sm"
        />
      </label>
      {errorMessage ? <p role="alert" className="text-sm text-[var(--color-danger)]">{errorMessage}</p> : null}
      <div className="flex gap-2">
        <Button type="button" variant="danger" loading={status === 'cancelling'} onClick={handleConfirm}>
          Confirm - stop renewal
        </Button>
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
          Keep renewal active
        </Button>
      </div>
    </div>
  );
}
