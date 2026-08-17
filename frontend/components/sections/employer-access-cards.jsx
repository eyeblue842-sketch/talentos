import { Building2, CheckCircle2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { buildPathWithParams, employerAuthRoutes } from '@/lib/auth-experience';

const cardDefinitions = [
  {
    type: 'CONSULTANCY',
    icon: Users,
    title: 'Consultancy Recruiter',
    description: 'For recruitment agencies, staffing firms, independent recruiters and placement consultancies.',
    subtitle: 'Recruit for multiple clients through your consultancy or staffing agency. Business and verified personal email addresses are accepted.',
    emailNote: 'Verified company/business, Gmail, or other verified personal email (disposable and abusive addresses are not accepted).',
  },
  {
    type: 'COMPANY',
    icon: Building2,
    title: 'Company Recruiter',
    description: 'For internal HR, Talent Acquisition and hiring teams recruiting directly for their company.',
    subtitle: 'Hire directly for your organization. A verified official company email address is required.',
    emailNote: 'Verified company/business-domain email only. Personal providers (Gmail, Yahoo, Outlook, Hotmail, Live, ProtonMail) and disposable addresses are not accepted.',
  },
];

export function EmployerAccessCards({ searchParams = {} }) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-6.5rem)] max-w-5xl flex-col justify-center px-1 py-10">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">Careeriz Hire</p>
        <h1 className="mt-4 font-[var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--color-text)] md:text-5xl">
          How are you hiring on Careeriz?
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--color-text-secondary)]">
          Choose the account type that matches who you recruit for. This only affects which email addresses are
          accepted at sign-up.
        </p>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {cardDefinitions.map(({ type, icon: Icon, title, description, subtitle, emailNote }) => (
          <Card
            key={type}
            variant="interactive"
            className="flex flex-col p-6 md:p-7"
            aria-labelledby={`employer-access-${type.toLowerCase()}-title`}
          >
            <div className="flex items-start gap-3">
              <span className="rounded-[16px] bg-[var(--color-primary-soft)] p-3 text-[var(--color-primary)]">
                <Icon size={22} aria-hidden="true" />
              </span>
              <div>
                <h2 id={`employer-access-${type.toLowerCase()}-title`} className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-text)]">
                  {title}
                </h2>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{subtitle}</p>

            <div className="mt-4 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-3 text-xs leading-5 text-[var(--color-text-secondary)]">
              {emailNote}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                as="a"
                href={buildPathWithParams(employerAuthRoutes.login, { ...searchParams, employerType: type })}
                variant="outline"
              >
                Log in
              </Button>
              <Button
                as="a"
                href={buildPathWithParams(employerAuthRoutes.register, { ...searchParams, employerType: type })}
              >
                Create account
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex items-start justify-center gap-2 text-center text-sm text-[var(--color-text-secondary)]">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
        <p>
          Both employer account types use the same Careeriz subscription plans and job-posting benefits.{' '}
          <Badge variant="neutral" className="align-middle">Pricing and features are identical</Badge>
        </p>
      </div>

      <p className="mt-4 text-center text-xs leading-5 text-[var(--color-text-muted)]">
        Company Recruiter accounts require a verified official company email address. If your company domain is not
        recognized, request verification after creating your account.
      </p>
    </section>
  );
}
