'use client';

import { useActionState, useEffect, useRef } from 'react';
import { withdrawCandidateApplicationAction } from '@/app/candidate/actions';

const initialState = {
  status: 'idle',
  message: '',
  fieldErrors: {},
};

export function CandidateApplicationWithdrawForm({ applicationId, canWithdraw }) {
  const [state, formAction, pending] = useActionState(withdrawCandidateApplicationAction, initialState);
  const messageRef = useRef(null);

  useEffect(() => {
    if (state.status !== 'idle' && messageRef.current) {
      messageRef.current.focus();
    }
  }, [state]);

  if (!canWithdraw) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Withdrawal is no longer available for this application.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      {state.status !== 'idle' ? (
        <div
          ref={messageRef}
          tabIndex={-1}
          role={state.status === 'error' ? 'alert' : 'status'}
          className={state.status === 'error'
            ? 'rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800'
            : 'rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'}
        >
          {state.message}
        </div>
      ) : null}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Reason</span>
        <select name="reason" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3">
          <option value="">Select a reason</option>
          <option value="ACCEPTED_ANOTHER_OFFER">Accepted another offer</option>
          <option value="NO_LONGER_INTERESTED">No longer interested</option>
          <option value="LOCATION_CONCERN">Location concern</option>
          <option value="COMPENSATION_CONCERN">Compensation concern</option>
          <option value="ROLE_MISMATCH">Role mismatch</option>
          <option value="PERSONAL_REASON">Personal reason</option>
          <option value="OTHER">Other</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Optional note</span>
        <textarea name="note" className="min-h-24 w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Share a brief note if helpful." />
      </label>
      <button type="submit" disabled={pending} className="rounded-2xl border border-rose-300 px-4 py-3 font-semibold text-rose-700 disabled:opacity-60">
        {pending ? 'Withdrawing...' : 'Withdraw application'}
      </button>
    </form>
  );
}
