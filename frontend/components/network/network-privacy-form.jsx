'use client';

import { useActionState, useEffect, useRef } from 'react';
import { updateNetworkPrivacyAction } from '@/app/network/actions';
import { Alert } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';

const initialState = {
  status: 'idle',
  message: '',
  fieldErrors: {},
};

export function NetworkPrivacyForm({ settings }) {
  const [state, formAction, pending] = useActionState(updateNetworkPrivacyAction, initialState);
  const summaryRef = useRef(null);

  useEffect(() => {
    if (state.status === 'error' && summaryRef.current) {
      summaryRef.current.focus();
    }
  }, [state]);

  return (
    <form action={formAction} className="grid gap-4">
      {state.status !== 'idle' ? (
        <Alert
          ref={summaryRef}
          tone={state.status === 'error' ? 'danger' : 'success'}
          title={state.status === 'error' ? 'Privacy update failed' : 'Privacy updated'}
          tabIndex={-1}
        >
          {state.message}
        </Alert>
      ) : null}

      <label className="grid gap-2 text-sm">
        <span className="font-semibold text-[var(--color-text)]">Who can send connection requests</span>
        <select
          name="allowConnectionRequestsFrom"
          defaultValue={settings.allowConnectionRequestsFrom || 'EVERYONE'}
          className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3"
        >
          <option value="EVERYONE">Everyone on Careeriz</option>
          <option value="RECRUITERS_ONLY">Recruiters only</option>
          <option value="NOBODY">Nobody</option>
        </select>
      </label>

      <label className="grid gap-2 text-sm">
        <span className="font-semibold text-[var(--color-text)]">Who can see your connections</span>
        <select
          name="connectionVisibility"
          defaultValue={settings.connectionVisibility || 'CONNECTIONS_ONLY'}
          className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3"
        >
          <option value="EVERYONE">Everyone</option>
          <option value="CONNECTIONS_ONLY">Connections only</option>
          <option value="NOBODY">Nobody</option>
        </select>
      </label>

      <Checkbox name="showInPeopleSearch" defaultChecked={settings.showInPeopleSearch} label="Allow people search discovery" />
      <Checkbox name="showRecruiterIdentity" defaultChecked={settings.showRecruiterIdentity} label="Show recruiter identity on company and job surfaces where permitted" />

      <Button type="submit" loading={pending} disabled={pending}>
        {pending ? 'Saving privacy...' : 'Save privacy settings'}
      </Button>
    </form>
  );
}
