"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, Building2, CheckCircle2, FileText, LogIn, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormActions, FormSection, InlineValidationMessage, PasswordField } from '@/components/ui/form-layout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { resolvePostAuthRoute, safeInternalPath } from '@/lib/roles';
import { buildPathWithParams, candidateAuthRoutes, employerAuthRoutes } from '@/lib/auth-experience';

const passwordHelpText = 'Use at least 8 characters. Choose a password you do not reuse elsewhere.';

function getOAuthHref(provider, mode, nextHref) {
  const url = new URL(`/api/auth/${provider}`, 'http://localhost');
  url.searchParams.set('role', 'CANDIDATE');
  url.searchParams.set('mode', mode);
  if (nextHref) {
    url.searchParams.set('next', nextHref);
  }
  return `${url.pathname}${url.search}`;
}

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

function SocialButtons({ mode, nextHref, providers }) {
  if (providers.googleVisible === false && !providers.linkedinConfigured) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {providers.googleVisible !== false ? (
        <Button as="a" href={getOAuthHref('google', mode, nextHref)} variant="outline" className="justify-center">
          Continue with Google
        </Button>
      ) : null}
      {providers.linkedinConfigured ? (
        <Button as="a" href={getOAuthHref('linkedin', mode, nextHref)} variant="outline" className="justify-center">
          Continue with LinkedIn
        </Button>
      ) : null}
    </div>
  );
}

function HeroPanel({ audience, mode }) {
  if (audience === 'employer') {
    return (
      <Card className="border-transparent bg-[linear-gradient(160deg,#22193f_0%,#52389d_58%,#6d5bd0_100%)] text-white shadow-[var(--shadow-floating)]">
        <Badge variant="neutral" className="w-fit border-white/14 bg-white/10 text-white">Careeriz Hire</Badge>
        <h2 className="mt-5 font-[var(--font-display)] text-4xl font-semibold tracking-tight">
          Your hiring workspace starts here.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-white/80 md:text-base">
          Manage jobs, candidates, interviews and hiring teams from one intelligent workspace.
        </p>
        <div className="mt-8 grid gap-4">
          <div className="rounded-[var(--radius-lg)] border border-white/12 bg-white/8 p-4">
            <div className="flex items-start gap-3">
              <Building2 size={18} className="mt-1 text-white" aria-hidden="true" />
              <div>
                <p className="font-semibold">Account</p>
                <p className="mt-1 text-sm text-white/76">Use your work email to access your employer account securely.</p>
              </div>
            </div>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-white/12 bg-white/8 p-4">
            <div className="flex items-start gap-3">
              <BriefcaseBusiness size={18} className="mt-1 text-white" aria-hidden="true" />
              <div>
                <p className="font-semibold">Organization</p>
                <p className="mt-1 text-sm text-white/76">Company, workspace, invitation, and future SSO steps can layer in here without changing the core login flow.</p>
              </div>
            </div>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-white/12 bg-white/8 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="mt-1 text-white" aria-hidden="true" />
              <div>
                <p className="font-semibold">Workspace</p>
                <p className="mt-1 text-sm text-white/76">Sign in lands users in the correct recruiter workspace based on the authenticated backend session role.</p>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-6 text-sm text-white/72">
          {mode === 'register'
            ? 'This is the account step. Organization and workspace setup continue after account verification.'
            : 'Use invitation links and future workspace-discovery flows from this entry point without exposing unfinished features now.'}
        </p>
      </Card>
    );
  }

  return (
    <Card className="border-transparent bg-[linear-gradient(160deg,#f1edff_0%,#ffffff_58%,#e8f0fe_100%)] shadow-[var(--shadow-lg)]">
      <Badge variant="purple" className="w-fit">Careeriz Jobs</Badge>
      <h2 className="mt-5 font-[var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--color-text)]">
        {mode === 'login' ? 'Welcome back to your career journey.' : 'Create your Careeriz profile.'}
      </h2>
      <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--color-text-secondary)] md:text-base">
        Search verified opportunities, understand your match, and manage your full job journey with Careeriz AI.
      </p>
      <div className="mt-8 grid gap-4">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white/88 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="mt-1 text-[var(--color-primary)]" aria-hidden="true" />
            <div>
              <p className="font-semibold text-[var(--color-text)]">AI Job Matching</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Discover relevant roles based on skills, experience and preferences.</p>
            </div>
          </div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white/88 p-4">
          <div className="flex items-start gap-3">
            <FileText size={18} className="mt-1 text-[var(--color-primary)]" aria-hidden="true" />
            <div>
              <p className="font-semibold text-[var(--color-text)]">Resume Intelligence</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Improve resume quality and understand job compatibility before you apply.</p>
            </div>
          </div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white/88 p-4">
          <div className="flex items-start gap-3">
            <LogIn size={18} className="mt-1 text-[var(--color-primary)]" aria-hidden="true" />
            <div>
              <p className="font-semibold text-[var(--color-text)]">Application Hub</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Track applications, interviews and next steps without losing context.</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function AuthExperience({
  audience,
  mode,
  providers = { googleVisible: true, linkedinConfigured: false },
  initialSearchParams = {},
}) {
  const [registerForm, setRegisterForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });
  const [resetEmail, setResetEmail] = useState('');
  const [resetForm, setResetForm] = useState({
    password: '',
    confirmPassword: '',
  });
  const [pendingAction, setPendingAction] = useState('');
  const [statusMessage, setStatusMessage] = useState(
    initialSearchParams.authStatus === 'email-verified'
      ? 'Email verified. You can now sign in.'
      : initialSearchParams.authStatus === 'password-reset-complete'
        ? 'Password reset complete. You can now sign in with the new password.'
        : initialSearchParams.authStatus === 'password-reset-ready'
          ? 'Reset link confirmed. Choose a new password.'
          : ''
  );
  const [errorMessage, setErrorMessage] = useState(
    initialSearchParams.resetError
      ? 'This password reset link is invalid or expired.'
      : initialSearchParams.oauthError || ''
  );
  const [isResetFlow, setIsResetFlow] = useState(initialSearchParams.authStatus === 'password-reset-ready');

  const nextHref = useMemo(
    () => safeInternalPath(initialSearchParams.next, audience === 'employer' ? '/recruiter' : '/candidate/dashboard'),
    [audience, initialSearchParams.next],
  );

  const registerPasswordMismatch = registerForm.confirmPassword.length > 0 && registerForm.password !== registerForm.confirmPassword;
  const resetPasswordMismatch = resetForm.confirmPassword.length > 0 && resetForm.password !== resetForm.confirmPassword;
  const alternateRoutes = audience === 'employer' ? employerAuthRoutes : candidateAuthRoutes;

  async function handleRegister() {
    setPendingAction('register');
    setErrorMessage('');
    setStatusMessage('');

    try {
      const payload = {
        email: registerForm.email,
        password: registerForm.password,
        role: audience === 'employer' ? 'RECRUITER' : 'CANDIDATE',
      };

      if (audience === 'candidate' && registerForm.fullName.trim()) {
        payload.fullName = registerForm.fullName.trim();
      }

      const response = await postJson('/api/auth/signup', payload);
      setStatusMessage(
        response.data.emailVerificationRequired
          ? 'Account created. Check your email to verify the account before signing in.'
          : 'Account created.'
      );
      setLoginForm({ email: registerForm.email, password: '' });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setPendingAction('');
    }
  }

  async function handleLogin() {
    setPendingAction('login');
    setErrorMessage('');
    setStatusMessage('');

    try {
      const response = await postJson('/api/auth/login', loginForm);
      const user = response.data.user;
      const target = user.mustChangePassword
        ? `/change-password${nextHref ? `?next=${encodeURIComponent(nextHref)}` : ''}`
        : resolvePostAuthRoute(user.role, nextHref);
      window.location.assign(target);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setPendingAction('');
    }
  }

  async function handleResetRequest() {
    setPendingAction('reset-request');
    setErrorMessage('');
    setStatusMessage('');

    try {
      await postJson('/api/auth/password-reset/request', { email: resetEmail });
      setStatusMessage('If the email exists, a password reset link has been sent.');
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setPendingAction('');
    }
  }

  async function handleResetConfirm() {
    setPendingAction('reset-confirm');
    setErrorMessage('');
    setStatusMessage('');

    try {
      await postJson('/api/auth/password-reset/confirm', { password: resetForm.password });
      setStatusMessage('Password reset complete. You can now sign in with the new password.');
      setIsResetFlow(false);
      setResetForm({ password: '', confirmPassword: '' });
      window.history.replaceState({}, '', mode === 'register' ? alternateRoutes.register : alternateRoutes.login);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setPendingAction('');
    }
  }

  async function resendVerification(email) {
    setPendingAction('resend-verification');
    setErrorMessage('');
    setStatusMessage('');

    try {
      await postJson('/api/auth/email-verification/request', { email });
      setStatusMessage('Verification email sent if the account exists and is still unverified.');
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setPendingAction('');
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-10 lg:px-10">
      <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-start">
        <HeroPanel audience={audience} mode={mode} />

        <div className="grid gap-6">
          <Card variant="elevated" className="p-6 md:p-7">
            <div>
              <Badge variant={audience === 'employer' ? 'neutral' : 'purple'}>
                {audience === 'employer' ? 'Careeriz Hire' : 'Careeriz Jobs'}
              </Badge>
              <h1 className="mt-4 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)]">
                {audience === 'candidate'
                  ? (mode === 'login' ? 'Welcome back to your career journey.' : 'Create your Careeriz profile.')
                  : (mode === 'login' ? 'Welcome back to Careeriz Hire.' : 'Create your employer account.')}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--color-text-secondary)]">
                {audience === 'candidate'
                  ? 'Sign in to continue your candidate journey or create a profile to start applying.'
                  : 'Access your hiring workspace or create the account step for your employer setup.'}
              </p>
            </div>

            <div aria-live="polite" className="mt-5 grid gap-3">
              {errorMessage ? (
                <Alert tone="danger" title="Authentication issue">
                  {errorMessage}
                </Alert>
              ) : null}
              {statusMessage ? (
                <Alert tone="success" title="Status updated">
                  {statusMessage}
                </Alert>
              ) : null}
            </div>

            {mode === 'register' ? (
              <FormSection
                className="mt-6 border-none bg-transparent p-0 shadow-none"
                title={audience === 'candidate' ? 'Create profile' : 'Create employer account'}
                description={audience === 'candidate'
                  ? 'Detailed profile completion happens after registration.'
                  : 'Only account fields supported by the current backend are submitted here.'}
              >
                {audience === 'candidate' ? (
                  <SocialButtons mode="signup" nextHref={nextHref} providers={providers} />
                ) : null}
                {audience === 'candidate' && (providers.googleVisible !== false || providers.linkedinConfigured) ? (
                  <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                    <span className="h-px flex-1 bg-[var(--color-border)]" />
                    or continue with email
                    <span className="h-px flex-1 bg-[var(--color-border)]" />
                  </div>
                ) : null}
                {audience === 'candidate' ? (
                  <Input
                    label="Full name"
                    value={registerForm.fullName}
                    onChange={(event) => setRegisterForm((current) => ({ ...current, fullName: event.target.value }))}
                    placeholder="Aarav Sharma"
                  />
                ) : null}
                <Input
                  label={audience === 'employer' ? 'Work email' : 'Email'}
                  type="email"
                  value={registerForm.email}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder={audience === 'employer' ? 'team@company.com' : 'candidate@example.com'}
                />
                <PasswordField
                  label="Password"
                  value={registerForm.password}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))}
                  helpText={passwordHelpText}
                />
                <PasswordField
                  label="Confirm password"
                  value={registerForm.confirmPassword}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                  error={registerPasswordMismatch ? 'Passwords must match.' : ''}
                />
                {audience === 'employer' ? (
                  <InlineValidationMessage tone="muted">
                    Step 1 of 3: account. Organization and workspace details remain future onboarding steps.
                  </InlineValidationMessage>
                ) : null}
                <FormActions className="justify-between">
                  <Button onClick={handleRegister} loading={pendingAction === 'register'} disabled={registerPasswordMismatch} trailingIcon={ArrowRight}>
                    {audience === 'candidate' ? 'Create profile' : 'Create employer account'}
                  </Button>
                  <Button variant="link" as={Link} href={mode === 'register' ? alternateRoutes.login : alternateRoutes.register}>
                    {audience === 'candidate' ? 'Already have a profile?' : 'Already have a workspace account?'}
                  </Button>
                </FormActions>
                <Button
                  type="button"
                  variant="link"
                  className="w-fit"
                  onClick={() => resendVerification(registerForm.email)}
                  disabled={pendingAction === 'resend-verification' || !registerForm.email}
                  leadingIcon={RefreshCw}
                >
                  Resend verification email
                </Button>
              </FormSection>
            ) : (
              <FormSection
                className="mt-6 border-none bg-transparent p-0 shadow-none"
                title={audience === 'candidate' ? 'Sign in' : 'Sign in to your workspace'}
                description={audience === 'candidate'
                  ? 'Use your verified account to continue applying and tracking opportunities.'
                  : 'Use the authenticated backend session as the source of truth for workspace routing.'}
              >
                {audience === 'candidate' ? (
                  <SocialButtons mode="login" nextHref={nextHref} providers={providers} />
                ) : null}
                {audience === 'candidate' && (providers.googleVisible !== false || providers.linkedinConfigured) ? (
                  <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                    <span className="h-px flex-1 bg-[var(--color-border)]" />
                    or continue with email
                    <span className="h-px flex-1 bg-[var(--color-border)]" />
                  </div>
                ) : null}
                <form
                  className="grid gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleLogin();
                  }}
                >
                  <Input
                    label={audience === 'employer' ? 'Work email' : 'Email'}
                    type="email"
                    autoComplete="username"
                    value={loginForm.email}
                    onChange={(event) => {
                      const value = event.target.value;
                      setLoginForm((current) => ({ ...current, email: value }));
                      setResetEmail(value);
                    }}
                    placeholder={audience === 'employer' ? 'team@company.com' : 'candidate@example.com'}
                  />
                  <PasswordField
                    label="Password"
                    autoComplete="current-password"
                    value={loginForm.password}
                    onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  />
                  <FormActions className="justify-between">
                    <Button type="submit" loading={pendingAction === 'login'}>
                      Sign in
                    </Button>
                    <Button type="button" variant="link" onClick={() => setIsResetFlow((current) => !current)}>
                      Forgot password
                    </Button>
                  </FormActions>
                </form>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                  <Link href={alternateRoutes.register} className="font-semibold text-[var(--color-primary)]">
                    {audience === 'candidate' ? 'Create a candidate profile' : 'Create employer workspace/account'}
                  </Link>
                  {audience === 'employer' ? (
                    <Link href={buildPathWithParams(employerAuthRoutes.landing, { entry: 'invite' })} className="font-semibold text-[var(--color-primary)]">
                      Join using invitation
                    </Link>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="link"
                  className="w-fit"
                  onClick={() => resendVerification(loginForm.email)}
                  disabled={pendingAction === 'resend-verification' || !loginForm.email}
                  leadingIcon={Mail}
                >
                  Resend verification
                </Button>
              </FormSection>
            )}
          </Card>

          <Card variant="outlined" className="p-6">
            <h2 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-text)]">
              {isResetFlow ? 'Reset password' : 'Need a password reset?'}
            </h2>
            <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">
              {isResetFlow
                ? 'Set a new password for the current reset session.'
                : 'Request a reset link without exposing whether the email exists.'}
            </p>
            <div className="mt-5 grid gap-4">
              {isResetFlow ? (
                <>
                  <PasswordField
                    label="New password"
                    value={resetForm.password}
                    onChange={(event) => setResetForm((current) => ({ ...current, password: event.target.value }))}
                    helpText={passwordHelpText}
                  />
                  <PasswordField
                    label="Confirm new password"
                    value={resetForm.confirmPassword}
                    onChange={(event) => setResetForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                    error={resetPasswordMismatch ? 'Passwords must match.' : ''}
                  />
                  <FormActions>
                    <Button onClick={handleResetConfirm} loading={pendingAction === 'reset-confirm'} disabled={resetPasswordMismatch}>
                      Set new password
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setIsResetFlow(false)}>
                      Cancel
                    </Button>
                  </FormActions>
                </>
              ) : (
                <>
                  <Input
                    label={audience === 'employer' ? 'Work email' : 'Email'}
                    type="email"
                    value={resetEmail}
                    onChange={(event) => setResetEmail(event.target.value)}
                    placeholder={audience === 'employer' ? 'team@company.com' : 'candidate@example.com'}
                  />
                  <Button onClick={handleResetRequest} loading={pendingAction === 'reset-request'} className="w-fit">
                    Send password reset link
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
