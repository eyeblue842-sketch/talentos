"use client";

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const inputClass = 'w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] px-4 py-3 text-sm';

// Shown on the invitation page to a visitor who is not signed in: the invited
// work email is fixed, they choose a password, and submitting creates the
// account, adds it to the organisation with the invited role and signs in.
export function InvitationSignupForm({ token, email, signInHref }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [accountExists, setAccountExists] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');

    setPending(true);
    try {
      const response = await fetch('/api/auth/invitation-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, password, confirmPassword }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setAccountExists(response.status === 409);
        throw new Error(body?.message || 'Could not create the account.');
      }
      window.location.assign('/recruiter/home?notice=invitation-accepted');
    } catch (caught) {
      setError(caught.message);
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="grid gap-2 text-sm">
        <span className="font-medium">Work email</span>
        <input className={`${inputClass} bg-[var(--color-bg-muted)]`} type="email" value={email} readOnly />
      </label>
      <label className="grid gap-2 text-sm">
        <span className="font-medium">Full name</span>
        <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
      </label>
      <label className="grid gap-2 text-sm">
        <span className="font-medium">Password</span>
        <input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
      </label>
      <label className="grid gap-2 text-sm">
        <span className="font-medium">Confirm password</span>
        <input className={inputClass} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required />
      </label>
      {error ? (
        <Alert tone="danger" title="Could not create account">
          {error}
          {accountExists ? <> <a className="underline" href={signInHref}>Sign in instead</a>.</> : null}
        </Alert>
      ) : null}
      <Button type="submit" loading={pending}>Create employer account</Button>
    </form>
  );
}
