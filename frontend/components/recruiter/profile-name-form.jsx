"use client";

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const inputClass = 'w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] px-4 py-3 text-sm';

function splitName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') };
}

// Lets a recruiter set the name shown on their workspace home (accounts created
// before names were collected have none).
export function ProfileNameForm({ initialName, email }) {
  const initial = splitName(initialName || '');
  const [firstName, setFirstName] = useState(initial.first);
  const [lastName, setLastName] = useState(initial.last);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required.');
      return;
    }
    setPending(true);
    try {
      const response = await fetch('/api/auth/me/name', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || 'Could not save your name.');
      setMessage('Name saved.');
    } catch (caught) {
      setError(caught.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
      <label className="grid gap-2 text-sm">
        <span className="font-medium">First name</span>
        <input className={inputClass} value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" />
      </label>
      <label className="grid gap-2 text-sm">
        <span className="font-medium">Last name</span>
        <input className={inputClass} value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" />
      </label>
      <label className="grid gap-2 text-sm md:col-span-2">
        <span className="font-medium">Email</span>
        <input className={`${inputClass} bg-[var(--color-bg-muted)]`} value={email || ''} readOnly />
      </label>
      {error ? <div className="md:col-span-2"><Alert tone="danger" title="Could not save">{error}</Alert></div> : null}
      {message ? <div className="md:col-span-2"><Alert tone="success" title={message} /></div> : null}
      <div className="md:col-span-2">
        <Button type="submit" loading={pending}>Save name</Button>
      </div>
    </form>
  );
}
