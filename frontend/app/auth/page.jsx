"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BriefcaseBusiness, FilePenLine, Linkedin, Mail, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';

const personalDomains = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'aol.com',
  'protonmail.com',
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

const initialSignupForm = {
  email: '',
  password: '',
  confirmPassword: '',
};

const initialLoginForm = {
  email: '',
  password: '',
};

const initialResetForm = {
  password: '',
  confirmPassword: '',
};

function extractDomain(email) {
  return email.toLowerCase().trim().split('@')[1] || '';
}

function getOAuthHref(provider, mode, options = {}) {
  const url = new URL(`${API_BASE_URL}/auth/oauth/${provider}/start`);
  url.searchParams.set('role', 'CANDIDATE');
  url.searchParams.set('mode', mode);

  Object.entries(options).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

function SocialButton({ icon: Icon, label, href }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[var(--text)]"
    >
      <Icon size={16} />
      {label}
    </a>
  );
}

function safeInternalPath(path, fallback = '/candidate') {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : fallback;
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

export default function AuthPage() {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [activeTab, setActiveTab] = useState('signup');
  const [recruiterSignup, setRecruiterSignup] = useState(initialSignupForm);
  const [candidateSignup, setCandidateSignup] = useState(initialSignupForm);
  const [recruiterLogin, setRecruiterLogin] = useState(initialLoginForm);
  const [candidateLogin, setCandidateLogin] = useState(initialLoginForm);
  const [resetRequestEmail, setResetRequestEmail] = useState('');
  const [resetForm, setResetForm] = useState(initialResetForm);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingAction, setPendingAction] = useState('');
  const [nextHref, setNextHref] = useState('/candidate');
  const [isResetFlow, setIsResetFlow] = useState(false);
  const [entrySource, setEntrySource] = useState('');
  const [candidateContext, setCandidateContext] = useState({
    candidateName: '',
    candidateEmail: '',
    jobTitle: '',
    company: '',
  });

  const recruiterDomainBlocked = useMemo(
    () => personalDomains.includes(extractDomain(recruiterSignup.email)),
    [recruiterSignup.email]
  );

  const recruiterPasswordMismatch =
    recruiterSignup.confirmPassword.length > 0 && recruiterSignup.password !== recruiterSignup.confirmPassword;
  const candidatePasswordMismatch =
    candidateSignup.confirmPassword.length > 0 && candidateSignup.password !== candidateSignup.confirmPassword;
  const resetPasswordMismatch =
    resetForm.confirmPassword.length > 0 && resetForm.password !== resetForm.confirmPassword;

  const candidateContextLabel =
    entrySource === 'careercraft' ? 'CareerCraft AI onboarding' : 'Candidate onboarding flow';
  const candidateOAuthParams = {
    next: nextHref,
    source: entrySource,
    candidateName: candidateContext.candidateName,
    candidateEmail: candidateContext.candidateEmail,
    jobTitle: candidateContext.jobTitle,
    company: candidateContext.company,
  };

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const params = new URLSearchParams(window.location.search);
      const next = params.get('next');
      const role = params.get('role');
      const source = params.get('source') || '';
      const candidateName = params.get('candidateName') || '';
      const candidateEmail = params.get('candidateEmail') || '';
      const jobTitle = params.get('jobTitle') || '';
      const company = params.get('company') || '';
      const oauthError = params.get('oauthError') || '';
      const authStatus = params.get('authStatus') || '';
      const resetError = params.get('resetError') || '';

      if (!cancelled) {
        if (next) {
          setNextHref(safeInternalPath(next));
        }
        if (role === 'candidate' || next?.includes('/candidate/')) {
          setActiveTab('signup');
        }
        setEntrySource(source);
        setCandidateContext({ candidateName, candidateEmail, jobTitle, company });
        if (candidateEmail) {
          setCandidateSignup((current) => ({ ...current, email: candidateEmail }));
          setCandidateLogin((current) => ({ ...current, email: candidateEmail }));
          setResetRequestEmail(candidateEmail);
        }
        if (oauthError) {
          setErrorMessage(oauthError);
        }
        if (resetError) {
          setErrorMessage('This password reset link is invalid or expired.');
        }
        if (authStatus === 'email-verified') {
          setStatusMessage('Email verified. You can now log in.');
        } else if (authStatus === 'password-reset-ready') {
          setStatusMessage('Reset link confirmed. Choose a new password.');
        } else if (authStatus === 'password-reset-complete') {
          setStatusMessage('Password reset complete. You can log in with the new password.');
        }
        if (authStatus === 'password-reset-ready') {
          setIsResetFlow(true);
          setActiveTab('login');
        }
      }

      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        if (response.ok) {
          const body = await response.json();
          if (!cancelled) {
            router.replace(body.data.role === 'RECRUITER' ? '/recruiter' : '/candidate');
            return;
          }
        }
      } finally {
        if (!cancelled) {
          setIsCheckingSession(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSignup(role) {
    const form = role === 'RECRUITER' ? recruiterSignup : candidateSignup;
    setPendingAction(`signup:${role}`);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const response = await postJson('/api/auth/signup', {
        email: form.email,
        password: form.password,
        role,
      });
      setStatusMessage(response.data.emailVerificationRequired
        ? 'Account created. Check your email to verify the account before logging in.'
        : 'Account created.');
      setActiveTab('login');
      if (role === 'RECRUITER') {
        setRecruiterLogin({ email: form.email, password: '' });
      } else {
        setCandidateLogin({ email: form.email, password: '' });
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setPendingAction('');
    }
  }

  async function handleLogin(role) {
    const form = role === 'RECRUITER' ? recruiterLogin : candidateLogin;
    setPendingAction(`login:${role}`);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const response = await postJson('/api/auth/login', form);
      const user = response.data.user;
      const target = user.role === 'RECRUITER' ? '/recruiter' : nextHref;
      router.replace(target);
      router.refresh();
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
      await postJson('/api/auth/password-reset/request', { email: resetRequestEmail });
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
      setStatusMessage('Password reset complete. You can log in with the new password.');
      setIsResetFlow(false);
      setResetForm(initialResetForm);
      window.history.replaceState({}, '', '/auth');
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

  if (isCheckingSession) {
    return (
      <main className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6 py-10 lg:px-10">
        <Card className="w-full max-w-xl text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">Authentication</p>
          <h1 className="mt-3 font-[var(--font-display)] text-3xl font-semibold">Checking your session</h1>
          <p className="mt-3 text-[var(--muted)]">Please wait while Careeriz verifies your authentication state.</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-10 lg:px-10">
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="bg-[#102418] text-white">
          <p className="text-sm uppercase tracking-[0.24em] text-white/56">Access Careeriz</p>
          <h1 className="mt-4 font-[var(--font-display)] text-4xl font-semibold">
            Register once, then complete the right profile for your side of hiring.
          </h1>
          <div className="mt-8 space-y-4 text-sm text-white/76">
            <div className="flex gap-3">
              <ShieldCheck size={18} className="mt-1" />
              <span>Recruiters and candidates can both register when visiting the platform for the first time.</span>
            </div>
            <div className="flex gap-3">
              <BriefcaseBusiness size={18} className="mt-1" />
              <span>Recruiter signup starts with company email and password only. Detailed company fields come on the next page.</span>
            </div>
            <div className="flex gap-3">
              <FilePenLine size={18} className="mt-1" />
              <span>Candidate signup also starts lightweight, then expands into a detailed profile after registration.</span>
            </div>
          </div>
          <div className="mt-10 rounded-[24px] border border-white/10 bg-white/6 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/56">{candidateContextLabel}</p>
            <div className="mt-4 grid gap-3 text-sm text-white/76">
              {candidateContext.candidateName || candidateContext.jobTitle || candidateContext.company ? (
                <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white/82">
                  {candidateContext.candidateName ? `Candidate: ${candidateContext.candidateName}` : 'Candidate details will be filled here.'}
                  {candidateContext.jobTitle ? ` | Role: ${candidateContext.jobTitle}` : ''}
                  {candidateContext.company ? ` | Source: ${candidateContext.company}` : ''}
                </div>
              ) : null}
              <div>Step 1: email, password, and re-type password</div>
              <div>Step 2: verify email before first login</div>
              <div>Step 3: continue to profile completion and resume tools</div>
            </div>
          </div>
        </Card>

        <div className="grid gap-6">
          <Card>
            {errorMessage ? (
              <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : null}
            {statusMessage ? (
              <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {statusMessage}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('signup')}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === 'signup' ? 'bg-[var(--brand)] text-white' : 'bg-[var(--soft)] text-[var(--brand)]'}`}
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === 'login' ? 'bg-[var(--brand)] text-white' : 'bg-[var(--soft)] text-[var(--brand)]'}`}
              >
                Login
              </button>
            </div>

            {activeTab === 'signup' ? (
              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <div className="rounded-[24px] border border-[var(--line)] p-5">
                  <div className="flex items-center gap-3">
                    <BriefcaseBusiness className="text-[var(--brand)]" size={18} />
                    <h2 className="font-[var(--font-display)] text-2xl font-semibold">Recruiter registration</h2>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    Recruiters only need company email, password, and re-type password here.
                  </p>
                  <div className="mt-5 grid gap-3">
                    <input
                      className={`rounded-2xl border px-4 py-3 ${recruiterDomainBlocked ? 'border-rose-300 bg-rose-50' : 'border-[var(--line)]'}`}
                      placeholder="Company email"
                      value={recruiterSignup.email}
                      onChange={(event) => setRecruiterSignup({ ...recruiterSignup, email: event.target.value })}
                    />
                    <input
                      className="rounded-2xl border border-[var(--line)] px-4 py-3"
                      placeholder="Password"
                      type="password"
                      value={recruiterSignup.password}
                      onChange={(event) => setRecruiterSignup({ ...recruiterSignup, password: event.target.value })}
                    />
                    <input
                      className={`rounded-2xl border px-4 py-3 ${recruiterPasswordMismatch ? 'border-rose-300 bg-rose-50' : 'border-[var(--line)]'}`}
                      placeholder="Re-type password"
                      type="password"
                      value={recruiterSignup.confirmPassword}
                      onChange={(event) => setRecruiterSignup({ ...recruiterSignup, confirmPassword: event.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => handleSignup('RECRUITER')}
                      disabled={recruiterDomainBlocked || recruiterPasswordMismatch || pendingAction === 'signup:RECRUITER'}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {pendingAction === 'signup:RECRUITER' ? 'Creating account...' : <>Continue to company details <ArrowRight size={16} /></>}
                    </button>
                    <button
                      type="button"
                      onClick={() => resendVerification(recruiterSignup.email)}
                      className="text-left text-sm text-[var(--brand)]"
                    >
                      Resend verification email
                    </button>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[var(--line)] p-5">
                  <div className="flex items-center gap-3">
                    <FilePenLine className="text-[var(--brand)]" size={18} />
                    <h2 className="font-[var(--font-display)] text-2xl font-semibold">Candidate registration</h2>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    Candidates only need email, password, and re-type password here. Detailed profile completion happens after login.
                  </p>
                  <div className="mt-5 grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SocialButton icon={Mail} label="Register with Google" href={getOAuthHref('google', 'signup', candidateOAuthParams)} />
                      <SocialButton icon={Linkedin} label="Register with LinkedIn" href={getOAuthHref('linkedin', 'signup', candidateOAuthParams)} />
                    </div>
                    <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                      <span className="h-px flex-1 bg-[var(--line)]" />
                      or continue with email
                      <span className="h-px flex-1 bg-[var(--line)]" />
                    </div>
                    <input
                      className="rounded-2xl border border-[var(--line)] px-4 py-3"
                      placeholder="Email"
                      value={candidateSignup.email}
                      onChange={(event) => setCandidateSignup({ ...candidateSignup, email: event.target.value })}
                    />
                    <input
                      className="rounded-2xl border border-[var(--line)] px-4 py-3"
                      placeholder="Password"
                      type="password"
                      value={candidateSignup.password}
                      onChange={(event) => setCandidateSignup({ ...candidateSignup, password: event.target.value })}
                    />
                    <input
                      className={`rounded-2xl border px-4 py-3 ${candidatePasswordMismatch ? 'border-rose-300 bg-rose-50' : 'border-[var(--line)]'}`}
                      placeholder="Re-type password"
                      type="password"
                      value={candidateSignup.confirmPassword}
                      onChange={(event) => setCandidateSignup({ ...candidateSignup, confirmPassword: event.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => handleSignup('CANDIDATE')}
                      disabled={candidatePasswordMismatch || pendingAction === 'signup:CANDIDATE'}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {pendingAction === 'signup:CANDIDATE' ? 'Creating account...' : <>Continue as candidate <ArrowRight size={16} /></>}
                    </button>
                    <button
                      type="button"
                      onClick={() => resendVerification(candidateSignup.email)}
                      className="text-left text-sm text-[var(--brand)]"
                    >
                      Resend verification email
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <div className="rounded-[24px] border border-[var(--line)] p-5">
                  <h2 className="font-[var(--font-display)] text-2xl font-semibold">Recruiter login</h2>
                  <div className="mt-5 grid gap-3">
                    <input
                      className="rounded-2xl border border-[var(--line)] px-4 py-3"
                      placeholder="company email"
                      value={recruiterLogin.email}
                      onChange={(event) => setRecruiterLogin({ ...recruiterLogin, email: event.target.value })}
                    />
                    <input
                      className="rounded-2xl border border-[var(--line)] px-4 py-3"
                      placeholder="password"
                      type="password"
                      value={recruiterLogin.password}
                      onChange={(event) => setRecruiterLogin({ ...recruiterLogin, password: event.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => handleLogin('RECRUITER')}
                      disabled={pendingAction === 'login:RECRUITER'}
                      className="rounded-2xl bg-[var(--brand)] px-4 py-3 text-center font-semibold text-white disabled:bg-slate-300"
                    >
                      {pendingAction === 'login:RECRUITER' ? 'Logging in...' : 'Continue as recruiter'}
                    </button>
                  </div>
                </div>
                <div className="rounded-[24px] border border-[var(--line)] p-5">
                  <h2 className="font-[var(--font-display)] text-2xl font-semibold">Candidate login</h2>
                  <div className="mt-5 grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SocialButton icon={Mail} label="Login with Google" href={getOAuthHref('google', 'login', candidateOAuthParams)} />
                      <SocialButton icon={Linkedin} label="Login with LinkedIn" href={getOAuthHref('linkedin', 'login', candidateOAuthParams)} />
                    </div>
                    <input
                      className="rounded-2xl border border-[var(--line)] px-4 py-3"
                      placeholder="email"
                      value={candidateLogin.email}
                      onChange={(event) => setCandidateLogin({ ...candidateLogin, email: event.target.value })}
                    />
                    <input
                      className="rounded-2xl border border-[var(--line)] px-4 py-3"
                      placeholder="password"
                      type="password"
                      value={candidateLogin.password}
                      onChange={(event) => setCandidateLogin({ ...candidateLogin, password: event.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => handleLogin('CANDIDATE')}
                      disabled={pendingAction === 'login:CANDIDATE'}
                      className="rounded-2xl border border-[var(--line)] px-4 py-3 text-center font-semibold text-[var(--text)] disabled:bg-slate-100"
                    >
                      {pendingAction === 'login:CANDIDATE' ? 'Logging in...' : 'Continue as candidate'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 rounded-[24px] border border-[var(--line)] p-5">
              <h3 className="font-[var(--font-display)] text-xl font-semibold">
                {isResetFlow ? 'Reset password' : 'Forgot password'}
              </h3>
              <div className="mt-4 grid gap-3">
                {isResetFlow ? (
                  <>
                    <input
                      className="rounded-2xl border border-[var(--line)] px-4 py-3"
                      placeholder="New password"
                      type="password"
                      value={resetForm.password}
                      onChange={(event) => setResetForm({ ...resetForm, password: event.target.value })}
                    />
                    <input
                      className={`rounded-2xl border px-4 py-3 ${resetPasswordMismatch ? 'border-rose-300 bg-rose-50' : 'border-[var(--line)]'}`}
                      placeholder="Confirm new password"
                      type="password"
                      value={resetForm.confirmPassword}
                      onChange={(event) => setResetForm({ ...resetForm, confirmPassword: event.target.value })}
                    />
                    <button
                      type="button"
                      onClick={handleResetConfirm}
                      disabled={resetPasswordMismatch || pendingAction === 'reset-confirm'}
                      className="rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-white disabled:bg-slate-300"
                    >
                      {pendingAction === 'reset-confirm' ? 'Resetting...' : 'Set new password'}
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      className="rounded-2xl border border-[var(--line)] px-4 py-3"
                      placeholder="Enter your account email"
                      value={resetRequestEmail}
                      onChange={(event) => setResetRequestEmail(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleResetRequest}
                      disabled={pendingAction === 'reset-request'}
                      className="rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-white disabled:bg-slate-300"
                    >
                      {pendingAction === 'reset-request' ? 'Sending...' : 'Send password reset link'}
                    </button>
                  </>
                )}
              </div>
            </div>

            <p className="mt-4 text-sm text-[var(--muted)]">
              Public entry points remain available from the landing page. Protected areas now require a verified authenticated session.
              <Link href="/" className="ml-1 text-[var(--brand)]">Back to home</Link>
            </p>
          </Card>
        </div>
      </div>
    </main>
  );
}
