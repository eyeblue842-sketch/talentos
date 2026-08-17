import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BriefcaseBusiness, ChevronRight, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { redirectIfAuthenticated } from '@/lib/auth';
import { buildPathWithParams, candidateAuthRoutes, employerAuthRoutes, getLegacyAuthDestination } from '@/lib/auth-experience';
import { redirectToSetupIfRequired } from '@/lib/setup';

export default async function AuthCompatibilityPage({ searchParams }) {
  await redirectToSetupIfRequired();
  await redirectIfAuthenticated();
  const params = await searchParams;
  const destination = getLegacyAuthDestination(params || {});

  if (destination.type === 'redirect') {
    redirect(destination.href);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-10 lg:px-10">
      <div className="grid w-full gap-6 lg:grid-cols-2">
        <Card variant="interactive" className="p-6">
          <UserRound size={22} className="text-[var(--color-primary)]" aria-hidden="true" />
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">Careeriz Jobs</p>
          <h1 className="mt-3 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)]">
            Continue as a candidate
          </h1>
          <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
            Access job search, profile creation, verification, and application tracking.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button as="a" href={buildPathWithParams(candidateAuthRoutes.login, params || {})}>
              Candidate sign in
              <ChevronRight size={18} aria-hidden="true" />
            </Button>
            <Button as="a" href={buildPathWithParams(candidateAuthRoutes.register, params || {})} variant="outline">
              Create profile
            </Button>
          </div>
        </Card>

        <Card variant="interactive" className="p-6">
          <BriefcaseBusiness size={22} className="text-[var(--color-primary)]" aria-hidden="true" />
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">Careeriz Hire</p>
          <h2 className="mt-3 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)]">
            Continue to your hiring workspace
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
            Access recruiter sign in, employer account creation, and invitation-based workspace entry.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button as="a" href={buildPathWithParams(employerAuthRoutes.landing, params || {})}>
              Employer sign in
              <ChevronRight size={18} aria-hidden="true" />
            </Button>
            <Button as="a" href={buildPathWithParams(employerAuthRoutes.landing, params || {})} variant="outline">
              Create employer account
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
