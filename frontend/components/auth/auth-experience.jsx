"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, Building2, CheckCircle2, FileText, LogIn, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { FormActions, FormSection, InlineValidationMessage, PasswordField } from '@/components/ui/form-layout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { resolvePostAuthRoute, safeInternalPath } from '@/lib/roles';
import { buildPathWithParams, candidateAuthRoutes, employerAuthRoutes, normalizeEmployerType } from '@/lib/auth-experience';

const passwordHelpText = 'Use at least 8 characters. Choose a password you do not reuse elsewhere.';

function getOAuthHref(provider, mode, nextHref, role = 'CANDIDATE', employerType) {
  const url = new URL(`/api/auth/${provider}`, 'http://localhost');
  url.searchParams.set('role', role);
  if (role === 'RECRUITER' && employerType) {
    url.searchParams.set('employerType', employerType);
  }
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

function GoogleMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

// Google sign-in is hidden for COMPANY recruiters - they must authenticate with
// their verified company-domain work email, not a personal Google account.
// Consultancy recruiters and candidates keep Google sign-in.
function isGoogleAllowed(providers, role, employerType) {
  if (providers.googleVisible === false) return false;
  if (role === 'RECRUITER' && employerType === 'COMPANY') return false;
  return true;
}

function hasSocialOptions(providers, role, employerType) {
  return isGoogleAllowed(providers, role, employerType) || Boolean(providers.linkedinConfigured);
}

function SocialButtons({ mode, nextHref, providers, role = 'CANDIDATE', employerType }) {
  const googleAllowed = isGoogleAllowed(providers, role, employerType);
  if (!googleAllowed && !providers.linkedinConfigured) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {googleAllowed ? (
        <a
          href={getOAuthHref('google', mode, nextHref, role, employerType)}
          className="inline-flex min-h-11 items-center justify-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white px-4 text-sm font-medium text-[var(--color-text)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--color-bg-muted)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--focus-ring-glow)]"
        >
          <GoogleMark />
          Continue with Google
        </a>
      ) : null}
      {providers.linkedinConfigured ? (
        <Button as="a" href={getOAuthHref('linkedin', mode, nextHref, role, employerType)} variant="outline" className="justify-center">
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
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });
  const [pendingAction, setPendingAction] = useState('');
  // Shown as a modal the user must acknowledge (OK) after creating an account.
  const [signupNotice, setSignupNotice] = useState('');
  const [statusMessage, setStatusMessage] = useState(
    initialSearchParams.authStatus === 'email-verified'
      ? 'Email verified. You can now sign in.'
      : initialSearchParams.resetSuccess
        ? 'Password reset complete. You can now sign in with the new password.'
        : ''
  );
  const [errorMessage, setErrorMessage] = useState(initialSearchParams.oauthError || '');

  const employerType = useMemo(
    () => normalizeEmployerType(initialSearchParams.employerType) || 'CONSULTANCY',
    [initialSearchParams.employerType],
  );

  const nextHref = useMemo(
    () => safeInternalPath(initialSearchParams.next, audience === 'employer' ? '/recruiter/home' : '/candidate/dashboard'),
    [audience, initialSearchParams.next],
  );

  const changeRecruiterTypeHref = useMemo(
    () => buildPathWithParams(employerAuthRoutes.landing, { next: initialSearchParams.next }),
    [initialSearchParams.next],
  );

  const forgotPasswordHref = useMemo(
    () => buildPathWithParams(
      audience === 'employer' ? employerAuthRoutes.forgotPassword : candidateAuthRoutes.forgotPassword,
      audience === 'employer'
        ? { employerType, next: initialSearchParams.next }
        : { next: initialSearchParams.next }
    ),
    [audience, employerType, initialSearchParams.next],
  );

  const registerPasswordMismatch = registerForm.confirmPassword.length > 0 && registerForm.password !== registerForm.confirmPassword;
  const alternateRoutes = audience === 'employer' ? employerAuthRoutes : candidateAuthRoutes;

  async function handleRegister() {
    setPendingAction('register');
    setErrorMessage('');
    setStatusMessage('');

    const firstName = registerForm.firstName.trim();
    const lastName = registerForm.lastName.trim();
    if (!firstName || !lastName) {
      setErrorMessage('First name and last name are required.');
      setPendingAction('');
      return;
    }

    try {
      const payload = {
        fullName: `${firstName} ${lastName}`,
        email: registerForm.email,
        password: registerForm.password,
        role: audience === 'employer' ? 'RECRUITER' : 'CANDIDATE',
      };

      if (audience === 'employer') {
        payload.employerType = employerType;
      }

      // Preserved so the emailed verification link can send the user back
      // here once they've verified (e.g. an organisation invitation they
      // arrived from) - see registerUser/confirmEmailVerification.
      if (initialSearchParams.next) {
        payload.next = initialSearchParams.next;
      }

      const response = await postJson('/api/auth/signup', payload);
      const pendingDomainReview = audience === 'employer'
        && employerType === 'COMPANY'
        && response.data.user?.recruiterProfile?.organisation?.domainVerificationStatus === 'PENDING';
      if (pendingDomainReview) {
        setSignupNotice('Account created. Check your email to verify the account. Your company domain is pending platform review before it is fully verified.');
      } else if (response.data.emailVerificationRequired) {
        setSignupNotice('Account created. Check your email to verify the account before signing in.');
      } else {
        setStatusMessage('Account created.');
      }
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
              {audience === 'employer' ? (
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  {employerType === 'COMPANY' ? 'Company Recruiter' : 'Consultancy Recruiter'} ·{' '}
                  <Link href={changeRecruiterTypeHref} className="font-semibold text-[var(--color-primary)]">
                    Change recruiter type
                  </Link>
                </p>
              ) : null}
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
                title={audience === 'candidate'
                  ? 'Create profile'
                  : `Create ${employerType === 'COMPANY' ? 'Company Recruiter' : 'Consultancy Recruiter'} account`}
                description={audience === 'candidate'
                  ? 'Detailed profile completion happens after registration.'
                  : 'Only account fields supported by the current backend are submitted here.'}
              >
                <SocialButtons
                  mode="signup"
                  nextHref={nextHref}
                  providers={providers}
                  role={audience === 'employer' ? 'RECRUITER' : 'CANDIDATE'}
                  employerType={employerType}
                />
                {hasSocialOptions(providers, audience === 'employer' ? 'RECRUITER' : 'CANDIDATE', employerType) ? (
                  <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                    <span className="h-px flex-1 bg-[var(--color-border)]" />
                    or continue with email
                    <span className="h-px flex-1 bg-[var(--color-border)]" />
                  </div>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="First name"
                    value={registerForm.firstName}
                    onChange={(event) => setRegisterForm((current) => ({ ...current, firstName: event.target.value }))}
                    placeholder="Aarav"
                    autoComplete="given-name"
                  />
                  <Input
                    label="Last name"
                    value={registerForm.lastName}
                    onChange={(event) => setRegisterForm((current) => ({ ...current, lastName: event.target.value }))}
                    placeholder="Sharma"
                    autoComplete="family-name"
                  />
                </div>
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
                    {employerType === 'COMPANY'
                      ? 'Company Recruiter accounts require a verified official company email address. If your company domain is not recognized, request verification.'
                      : 'Business and verified personal email addresses are both accepted for Consultancy Recruiter accounts.'}
                  </InlineValidationMessage>
                ) : null}
                <FormActions className="justify-between">
                  <Button onClick={handleRegister} loading={pendingAction === 'register'} disabled={registerPasswordMismatch || !registerForm.firstName.trim() || !registerForm.lastName.trim()} trailingIcon={ArrowRight}>
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
                <SocialButtons
                  mode="login"
                  nextHref={nextHref}
                  providers={providers}
                  role={audience === 'employer' ? 'RECRUITER' : 'CANDIDATE'}
                  employerType={employerType}
                />
                {hasSocialOptions(providers, audience === 'employer' ? 'RECRUITER' : 'CANDIDATE', employerType) ? (
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
                    <Button variant="link" as={Link} href={forgotPasswordHref}>
                      Forgot password?
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
        </div>
      </div>
      <Dialog open={Boolean(signupNotice)} onClose={() => setSignupNotice('')} title="Account created" className="max-w-md">
        <p className="text-sm text-[var(--color-text-secondary)]">{signupNotice}</p>
        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={() => setSignupNotice('')}>OK</Button>
        </div>
      </Dialog>
    </main>
  );
}
