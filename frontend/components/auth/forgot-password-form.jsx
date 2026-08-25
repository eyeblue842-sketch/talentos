"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormActions, FormSection } from '@/components/ui/form-layout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { candidateAuthRoutes, employerAuthRoutes } from '@/lib/auth-experience';

const NON_ENUMERATING_MESSAGE = "If an account exists for that email, we've sent password reset instructions.";

export function ForgotPasswordForm({ audience, employerType, next }) {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loginHref = audience === 'employer' ? employerAuthRoutes.login : candidateAuthRoutes.login;

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, audience, employerType, next }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || 'Request failed.');
      }

      // Always the same confirmation, whether or not the account exists.
      setSubmitted(true);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-16">
      <Card variant="elevated" className="p-6 md:p-7">
        <Badge variant={audience === 'employer' ? 'neutral' : 'purple'}>
          {audience === 'employer' ? 'Careeriz Hire' : 'Careeriz Jobs'}
        </Badge>
        <h1 className="mt-4 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)]">
          Forgot your password?
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--color-text-secondary)]">
          Enter your account email and, if it matches an account, we&rsquo;ll send a link to reset your password.
        </p>

        <div aria-live="polite" className="mt-5 grid gap-3">
          {errorMessage ? (
            <Alert tone="danger" title="Something went wrong">
              {errorMessage}
            </Alert>
          ) : null}
          {submitted ? (
            <Alert tone="success" title="Check your email">
              {NON_ENUMERATING_MESSAGE}
            </Alert>
          ) : null}
        </div>

        {!submitted ? (
          <FormSection className="mt-6 border-none bg-transparent p-0 shadow-none" title="Reset password">
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <Input
                label={audience === 'employer' ? 'Work email' : 'Email'}
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={audience === 'employer' ? 'team@company.com' : 'candidate@example.com'}
              />
              <FormActions>
                <Button type="submit" loading={pending} trailingIcon={ArrowRight}>
                  Send reset link
                </Button>
              </FormActions>
            </form>
          </FormSection>
        ) : null}

        <p className="mt-6 text-sm">
          <Link href={loginHref} className="font-semibold text-[var(--color-primary)]">
            Back to sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}
