import Link from 'next/link';
import { BriefcaseBusiness } from 'lucide-react';
import { PublicJobSearchForm } from '@/components/sections/public-job-search-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { candidateAuthRoutes } from '@/lib/auth-experience';

const popularSearches = [
  { label: 'Java', href: '/jobs?keyword=Java' },
  { label: 'React', href: '/jobs?keyword=React' },
  { label: 'AI', href: '/jobs?keyword=AI' },
  { label: 'Data', href: '/jobs?keyword=Data' },
  { label: 'Cloud', href: '/jobs?keyword=Cloud' },
  { label: 'Remote', href: '/jobs?workplaceType=REMOTE' },
  { label: 'Fresher', href: '/jobs?fresherFriendly=true' },
];

const previewMetrics = [
  ['Resume Score', '92%', 'Strong structure and keyword coverage'],
  ['AI Match', '89%', 'Backend platform role alignment'],
  ['Applications', '18', 'Tracked across active opportunities'],
  ['Upcoming Interviews', '4', 'Preparation plans already scheduled'],
];

const recommendedRoles = [
  { id: 'preview-1', title: 'Senior Backend Engineer', location: 'Bengaluru', company: 'Careeriz Partner', fit: '92% Fit' },
  { id: 'preview-2', title: 'Cloud Platform Developer', location: 'Remote', company: 'Growth Studio', fit: '88% Fit' },
];

export function CandidateLanding() {
  return (
    <section className="grid gap-5 rounded-[32px] border border-[var(--color-border)] bg-[linear-gradient(145deg,rgba(255,255,255,0.96)_0%,rgba(241,236,255,0.96)_48%,rgba(235,245,255,0.92)_100%)] p-5 shadow-[var(--shadow-floating)] sm:p-7 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
      <div className="max-w-3xl">
        <Badge variant="purple" className="px-4 py-1.5 text-[11px] uppercase tracking-[0.24em]">
          Careeriz Jobs
        </Badge>
        <h1 className="mt-4 max-w-2xl font-[var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--color-text)] sm:text-5xl xl:text-[3.65rem]">
          Build a career that moves forward.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--color-text-secondary)] sm:text-lg">
          Discover relevant opportunities, improve your resume with AI, prepare for interviews, and track every application from one focused candidate experience.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button as="a" href={candidateAuthRoutes.login} size="lg">
            Candidate Sign In
          </Button>
          <Button as="a" href={candidateAuthRoutes.register} variant="outline" size="lg">
            Create Profile
          </Button>
        </div>

        <div className="mt-5 max-w-4xl">
          <PublicJobSearchForm action="/jobs" searchParams={{}} variant="hero" />
        </div>

        <div className="mt-5">
          <p className="text-sm font-medium text-[var(--color-text-muted)]">Popular searches</p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {popularSearches.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-white/92 px-4 py-2 text-sm font-semibold text-[var(--color-text)] shadow-[var(--shadow-sm)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:pt-[2px]">
        <Card className="overflow-hidden border-[color:rgba(82,56,157,0.18)] bg-[linear-gradient(180deg,rgba(19,17,33,0.98)_0%,rgba(31,28,52,0.98)_100%)] p-0 text-white shadow-[var(--shadow-floating)]">
          <div className="border-b border-white/10 px-4 py-3.5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/52">Careeriz Jobs</p>
                <h2 className="mt-1 font-[var(--font-display)] text-lg font-semibold sm:text-xl">Candidate intelligence dashboard</h2>
              </div>
              <Badge variant="neutral" className="border-white/12 bg-white/10 text-white">Live Preview</Badge>
            </div>
          </div>

          <div className="grid gap-3 px-4 py-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="grid gap-3 sm:grid-cols-2">
              {previewMetrics.map(([label, value, body]) => (
                <div key={label} className="rounded-[18px] border border-white/10 bg-white/6 p-3.5">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/48">{label}</p>
                  <p className="mt-2 text-2xl font-semibold">{value}</p>
                  <p className="mt-1.5 text-sm text-white/66">{body}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white p-4 text-[var(--color-text)] shadow-[var(--shadow-lg)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Recommended roles</p>
                  <h3 className="mt-2 text-base font-semibold">What to apply for next</h3>
                </div>
                <Badge variant="purple">AI Prioritized</Badge>
              </div>
              <div className="mt-3 grid gap-3">
                {recommendedRoles.map((job, index) => (
                  <div key={job.id} className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-page)] px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--color-text)]">{job.title}</p>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{job.company}</p>
                      </div>
                      <Badge variant={index === 0 ? 'success' : 'info'}>{job.fit}</Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
                      <span className="inline-flex items-center gap-1.5"><BriefcaseBusiness size={14} aria-hidden="true" /> {job.location}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
