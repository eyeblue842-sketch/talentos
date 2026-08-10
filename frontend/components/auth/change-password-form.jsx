"use client";

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PasswordField } from '@/components/ui/input';
import { getHomeRouteForRole, resolvePostAuthRoute } from '@/lib/roles';

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

  return body;
}

/**
 * Handles both the forced first-login password change (temporary password
 * issued by the test-account bootstrap or an admin reset) and a voluntary
 * password change. The server is the real gate - the backend auth()
 * middleware rejects every other route while mustChangePassword is true - this
 * form only provides the UI for clearing it.
 */
export function ChangePasswordForm({ role, required, next }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (newPassword.length < 8 || newPassword.length > 72) {
      setError('New password must be between 8 and 72 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setPending(true);
    try {
      const response = await postJson('/api/auth/change-password', { currentPassword, newPassword });
      const target = resolvePostAuthRoute(response.data.user.role, next);
      window.location.assign(target);
    } catch (caught) {
      setError(caught.message || 'Unable to change password.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-10">
      <Card className="w-full p-6">
        <ShieldAlert size={22} className="text-[var(--color-primary)]" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--color-text)]">
          {required ? 'Set a new password' : 'Change your password'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          {required
            ? 'You are using a temporary password. Set a new password to continue into Careeriz.'
            : 'Enter your current password and choose a new one.'}
        </p>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <PasswordField
            label={required ? 'Temporary password' : 'Current password'}
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
          <PasswordField
            label="New password"
            autoComplete="new-password"
            helpText="8-72 characters."
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />

          {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}

          <div className="mt-2 flex items-center justify-between gap-3">
            {!required ? (
              <Button as="a" href={getHomeRouteForRole(role)} type="button" variant="outline">
                Cancel
              </Button>
            ) : <span />}
            <Button type="submit" loading={pending}>
              Change password
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
