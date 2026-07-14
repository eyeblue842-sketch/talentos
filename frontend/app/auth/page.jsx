"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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

const initialRecruiter = {
  email: '',
  password: '',
  confirmPassword: '',
};

const initialCandidate = {
  email: '',
  password: '',
  confirmPassword: '',
};

function extractDomain(email) {
  return email.toLowerCase().trim().split('@')[1] || '';
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

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

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState('signup');
  const [recruiterForm, setRecruiterForm] = useState(initialRecruiter);
  const [candidateForm, setCandidateForm] = useState(initialCandidate);
  const [oauthError, setOauthError] = useState('');
  const [nextHref, setNextHref] = useState('/candidate');
  const [entrySource, setEntrySource] = useState('');
  const [candidateContext, setCandidateContext] = useState({
    candidateName: '',
    candidateEmail: '',
    jobTitle: '',
    company: '',
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOauthError(params.get('oauthError') || '');
    const next = params.get('next');
    const role = params.get('role');
    const source = params.get('source') || '';
    const candidateName = params.get('candidateName') || '';
    const candidateEmail = params.get('candidateEmail') || '';
    const jobTitle = params.get('jobTitle') || '';
    const company = params.get('company') || '';

    if (next) {
      setNextHref(next);
    }

    if (role === 'candidate' || next?.includes('/candidate/')) {
      setActiveTab('signup');
    }

    setEntrySource(source);
    setCandidateContext({ candidateName, candidateEmail, jobTitle, company });

    if (candidateEmail) {
      setCandidateForm((current) => ({ ...current, email: candidateEmail }));
    }
  }, []);

  const recruiterDomainBlocked = useMemo(
    () => personalDomains.includes(extractDomain(recruiterForm.email)),
    [recruiterForm.email],
  );

  const recruiterPasswordMismatch =
    recruiterForm.confirmPassword.length > 0 && recruiterForm.password !== recruiterForm.confirmPassword;

  const candidatePasswordMismatch =
    candidateForm.confirmPassword.length > 0 && candidateForm.password !== candidateForm.confirmPassword;

  const candidatePrimaryHref = candidatePasswordMismatch ? '#' : nextHref;
  const candidateContextLabel =
    entrySource === 'careercraft'
      ? 'CareerCraft AI onboarding'
      : 'Candidate onboarding flow';
  const candidateOAuthParams = {
    next: nextHref,
    source: entrySource,
    candidateName: candidateContext.candidateName,
    candidateEmail: candidateContext.candidateEmail,
    jobTitle: candidateContext.jobTitle,
    company: candidateContext.company,
  };

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-10 lg:px-10">
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="bg-[#102418] text-white">
          <p className="text-sm uppercase tracking-[0.24em] text-white/56">Access CareerCraft AI</p>
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
              <span>Candidate signup also starts lightweight, then expands into a detailed Naukri-style profile page after registration.</span>
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
              <div>Step 2: profile headline, work history, education, resume, key skills, notice period, and preferences</div>
              <div>Step 3: continue to the resume builder and prepare an ATS-ready profile</div>
            </div>
          </div>
        </Card>

        <div className="grid gap-6">
          <Card>
            {oauthError ? (
              <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {oauthError}
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
                      value={recruiterForm.email}
                      onChange={(event) => setRecruiterForm({ ...recruiterForm, email: event.target.value })}
                    />
                    {recruiterDomainBlocked ? (
                      <p className="text-sm text-rose-600">Recruiters cannot register using Gmail, Yahoo, Outlook, or similar personal email domains.</p>
                    ) : (
                      <p className="text-sm text-[var(--muted)]">Example: recruiter@company.com</p>
                    )}
                    <input
                      className="rounded-2xl border border-[var(--line)] px-4 py-3"
                      placeholder="Password"
                      type="password"
                      value={recruiterForm.password}
                      onChange={(event) => setRecruiterForm({ ...recruiterForm, password: event.target.value })}
                    />
                    <input
                      className={`rounded-2xl border px-4 py-3 ${recruiterPasswordMismatch ? 'border-rose-300 bg-rose-50' : 'border-[var(--line)]'}`}
                      placeholder="Re-type password"
                      type="password"
                      value={recruiterForm.confirmPassword}
                      onChange={(event) => setRecruiterForm({ ...recruiterForm, confirmPassword: event.target.value })}
                    />
                    {recruiterPasswordMismatch ? (
                      <p className="text-sm text-rose-600">Password and re-type password must match.</p>
                    ) : null}
                    <Link
                      href="/recruiter/onboarding"
                      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold text-white ${recruiterDomainBlocked || recruiterPasswordMismatch ? 'pointer-events-none bg-slate-300' : 'bg-[var(--brand)]'}`}
                    >
                      Continue to company details <ArrowRight size={16} />
                    </Link>
                    <p className="text-sm text-[var(--muted)]">
                      If this recruiter email is already registered, the API will respond with: "This company email is already registered with us. Please login instead."
                    </p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[var(--line)] p-5">
                  <div className="flex items-center gap-3">
                    <FilePenLine className="text-[var(--brand)]" size={18} />
                    <h2 className="font-[var(--font-display)] text-2xl font-semibold">Candidate registration</h2>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    Candidates only need email, password, and re-type password here. Detailed profile completion happens right after signup.
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
                      value={candidateForm.email}
                      onChange={(event) => setCandidateForm({ ...candidateForm, email: event.target.value })}
                    />
                    <input
                      className="rounded-2xl border border-[var(--line)] px-4 py-3"
                      placeholder="Password"
                      type="password"
                      value={candidateForm.password}
                      onChange={(event) => setCandidateForm({ ...candidateForm, password: event.target.value })}
                    />
                    <input
                      className={`rounded-2xl border px-4 py-3 ${candidatePasswordMismatch ? 'border-rose-300 bg-rose-50' : 'border-[var(--line)]'}`}
                      placeholder="Re-type password"
                      type="password"
                      value={candidateForm.confirmPassword}
                      onChange={(event) => setCandidateForm({ ...candidateForm, confirmPassword: event.target.value })}
                    />
                    {candidatePasswordMismatch ? (
                      <p className="text-sm text-rose-600">Password and re-type password must match.</p>
                    ) : null}
                    <Link
                      href={candidatePrimaryHref}
                      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold text-white ${candidatePasswordMismatch ? 'pointer-events-none bg-slate-300' : 'bg-[var(--brand)]'}`}
                    >
                      Continue as candidate <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <div className="rounded-[24px] border border-[var(--line)] p-5">
                  <h2 className="font-[var(--font-display)] text-2xl font-semibold">Recruiter login</h2>
                  <div className="mt-5 grid gap-3">
                    <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="company email" />
                    <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="password" type="password" />
                    <Link href="/recruiter" className="rounded-2xl bg-[var(--brand)] px-4 py-3 text-center font-semibold text-white">
                      Continue as recruiter
                    </Link>
                  </div>
                </div>
                <div className="rounded-[24px] border border-[var(--line)] p-5">
                  <h2 className="font-[var(--font-display)] text-2xl font-semibold">Candidate login</h2>
                  <div className="mt-5 grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SocialButton icon={Mail} label="Login with Google" href={getOAuthHref('google', 'login', candidateOAuthParams)} />
                      <SocialButton icon={Linkedin} label="Login with LinkedIn" href={getOAuthHref('linkedin', 'login', candidateOAuthParams)} />
                    </div>
                    <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="email" />
                    <input className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="password" type="password" />
                    <Link href={nextHref} className="rounded-2xl border border-[var(--line)] px-4 py-3 text-center font-semibold text-[var(--text)]">
                      Continue as candidate
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
