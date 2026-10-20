"use client";

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function ResendVerificationForm() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/auth/email-verification/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || 'Could not send the email. Please try again.');
      setMessage('If that account exists and is not yet verified, a new verification email is on its way.');
    } catch (caught) {
      setError(caught.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="grid gap-2 text-sm">
        <span className="font-medium">Email</span>
        <input
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] px-4 py-3 text-sm"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </label>
      {error ? <Alert tone="danger" title="Could not send">{error}</Alert> : null}
      {message ? <Alert tone="success" title="Check your inbox">{message}</Alert> : null}
      <Button type="submit" loading={pending} className="w-full">Send a new verification email</Button>
    </form>
  );
}
