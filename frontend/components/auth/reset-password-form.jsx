"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormActions, FormSection, InlineValidationMessage, PasswordField } from '@/components/ui/form-layout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { buildPathWithParams, candidateAuthRoutes, employerAuthRoutes } from '@/lib/auth-experience';

const passwordHelpText = 'Use at least 8 characters. Choose a password you do not reuse elsewhere.';

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

// linkInvalid: the reset link itself was missing/expired/already used (the
// Next.js route handler for the emailed link sets this before this page even
// renders) - shown instead of the OTP/password form since there is no valid
// reset session to act on.
export function ResetPasswordForm({ linkInvalid = false }) {
  const [stage, setStage] = useState('otp');
  const [code, setCode] = useState('');
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });
  const [pendingAction, setPendingAction] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [resetTarget, setResetTarget] = useState(null);

  const passwordMismatch = passwordForm.confirmPassword.length > 0 && passwordForm.password !== passwordForm.confirmPassword;

  async function handleVerifyOtp(event) {
    event.preventDefault();
    setPendingAction('verify');
    setErrorMessage('');
    setStatusMessage('');

    try {
      await postJson('/api/auth/password-reset/otp/verify', { code });
      setStage('password');
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setPendingAction('');
    }
  }

  async function handleResendOtp() {
    setPendingAction('resend');
    setErrorMessage('');
    setStatusMessage('');

    try {
      await postJson('/api/auth/password-reset/otp/resend', {});
      setStatusMessage('A new verification code has been sent.');
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setPendingAction('');
    }
  }

  async function handleSetPassword(event) {
    event.preventDefault();
    setPendingAction('confirm');
    setErrorMessage('');
    setStatusMessage('');

    try {
      const response = await postJson('/api/auth/password-reset/confirm', { password: passwordForm.password });
      const audience = response.data?.audience;
      const employerType = response.data?.employerType;
      const target = audience === 'employer'
        ? buildPathWithParams(employerAuthRoutes.login, { employerType: employerType || 'CONSULTANCY', resetSuccess: '1' })
        : buildPathWithParams(candidateAuthRoutes.login, { resetSuccess: '1' });
      setResetTarget(target);
      setStatusMessage('Password reset complete. Redirecting to sign in...');
      window.setTimeout(() => window.location.assign(target), 1200);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setPendingAction('');
    }
  }

  if (linkInvalid) {
    return (
      <main className="mx-auto min-h-screen max-w-xl px-6 py-16">
        <Card variant="elevated" className="p-6 md:p-7">
          <Badge variant="neutral">Careeriz</Badge>
          <h1 className="mt-4 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)]">
            This reset link is invalid or has expired.
          </h1>
          <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
            Reset links can only be used once and expire after a short time. Request a new one from your sign-in page.
          </p>
          <p className="mt-6 text-sm">
            <Link href="/auth" className="font-semibold text-[var(--color-primary)]">
              Back to sign in
            </Link>
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-16">
      <Card variant="elevated" className="p-6 md:p-7">
        <Badge variant="neutral">Careeriz</Badge>
        <h1 className="mt-4 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)]">
          {stage === 'otp' ? 'Enter your verification code' : 'Choose a new password'}
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
          {stage === 'otp'
            ? "We emailed a 6-digit code to your address. Enter it below to continue."
            : 'Your identity is verified. Set a new password for your account.'}
        </p>

        <div aria-live="polite" className="mt-5 grid gap-3">
          {errorMessage ? (
            <Alert tone="danger" title="Verification issue">
              {errorMessage}
            </Alert>
          ) : null}
          {statusMessage ? (
            <Alert tone="success" title="Status updated">
              {statusMessage}
            </Alert>
          ) : null}
        </div>

        {stage === 'otp' ? (
          <FormSection className="mt-6 border-none bg-transparent p-0 shadow-none" title="Verification code">
            <form className="grid gap-4" onSubmit={handleVerifyOtp}>
              <Input
                label="6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
              />
              <FormActions className="justify-between">
                <Button type="submit" loading={pendingAction === 'verify'} disabled={code.length !== 6} trailingIcon={ArrowRight}>
                  Verify code
                </Button>
                <Button
                  type="button"
                  variant="link"
                  onClick={handleResendOtp}
                  disabled={pendingAction === 'resend'}
                  leadingIcon={RefreshCw}
                >
                  Resend code
                </Button>
              </FormActions>
            </form>
          </FormSection>
        ) : (
          <FormSection className="mt-6 border-none bg-transparent p-0 shadow-none" title="New password">
            <form className="grid gap-4" onSubmit={handleSetPassword}>
              <PasswordField
                label="New password"
                value={passwordForm.password}
                onChange={(event) => setPasswordForm((current) => ({ ...current, password: event.target.value }))}
                helpText={passwordHelpText}
              />
              <PasswordField
                label="Confirm new password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                error={passwordMismatch ? 'Passwords must match.' : ''}
              />
              <FormActions>
                <Button
                  type="submit"
                  loading={pendingAction === 'confirm'}
                  disabled={passwordMismatch || !passwordForm.password || Boolean(resetTarget)}
                >
                  Set new password
                </Button>
              </FormActions>
            </form>
          </FormSection>
        )}
      </Card>
    </main>
  );
}
