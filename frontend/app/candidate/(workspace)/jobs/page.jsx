import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CareerizAppShell } from '@/components/layout/careeriz-app-shell';
import { CandidateSectionTabs } from '@/components/candidate/candidate-section-tabs';
import { CandidateJobActivity } from '@/components/candidate/candidate-job-activity';
import { PaginationNav } from '@/components/sections/pagination-nav';
import { PublicJobCard } from '@/components/sections/public-job-card';
import { PublicJobSearchForm } from '@/components/sections/public-job-search-form';
import { Card } from '@/components/ui/card';
import {
  getCandidateApplications,
  getCandidateInterviews,
  getCandidateOffers,
  getCandidateRecommendations,
  getCandidateSavedJobs,
  getPublicJobs,
} from '@/lib/api';
import { candidateNav, candidateJobsTabs } from '@/lib/navigation';
import { saveJobAction, unsaveJobAction } from '@/app/candidate/actions';
import { buildPathWithQuery, withPage } from '@/lib/query';

export default async function CandidateJobsPage({ searchParams }) {
  const params = await searchParams;
  const [jobs, recommendations, savedJobs, applications, interviews, offers] = await Promise.all([
    getPublicJobs(params || {}),
    getCandidateRecommendations(),
    getCandidateSavedJobs({ pageSize: 1 }).catch(() => ({ items: [], meta: {} })),
    getCandidateApplications({ pageSize: 1 }).catch(() => ({ items: [], meta: {} })),
    getCandidateInterviews().catch(() => []),
    getCandidateOffers().catch(() => []),
  ]);
  const activityCounts = {
    saved: savedJobs?.meta?.total ?? savedJobs?.items?.length ?? 0,
    applications: applications?.meta?.total ?? applications?.items?.length ?? 0,
    interviews: Array.isArray(interviews) ? interviews.length : 0,
    offers: Array.isArray(offers) ? offers.length : 0,
  };
  if (String(params?.page || '1') !== String(jobs.meta.page)) {
    redirect(buildPathWithQuery('/candidate/jobs', withPage(params || {}, jobs.meta.page)));
  }
  const redirectTo = buildPathWithQuery('/candidate/jobs', params || {});

  return (
    <CareerizAppShell brand="Careeriz" items={candidateNav}>
        <CandidateSectionTabs tabs={candidateJobsTabs} />
        <Card className="rounded-[32px] bg-[var(--surface)] p-6 shadow-[0_20px_60px_rgba(16,36,24,0.08)] md:p-7">
          <h1 className="font-[var(--font-display)] text-4xl font-semibold tracking-tight">Browse jobs</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Search the public job market, save roles, and compare them against deterministic recommendations.</p>
          <div className="mt-6">
            <PublicJobSearchForm action="/candidate/jobs" searchParams={params || {}} />
          </div>
        </Card>

        <CandidateJobActivity
          saved={activityCounts.saved}
          applications={activityCounts.applications}
          interviews={activityCounts.interviews}
          offers={activityCounts.offers}
        />

        <Card className="rounded-[30px] bg-white p-6 shadow-[0_18px_48px_rgba(16,36,24,0.07)]">
          <h2 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight">Recommended for you</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{recommendations.prompt || 'Based on your current profile and public job availability.'}</p>
          {recommendations.recommendedJobs.length ? (
            <ul className="mt-5 divide-y divide-[var(--line)]">
              {recommendations.recommendedJobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.slug}`}
                    className="flex items-center justify-between gap-3 py-3 text-lg font-semibold text-[var(--color-primary)] transition hover:underline"
                  >
                    <span>{job.title}</span>
                    <span aria-hidden="true" className="text-[var(--muted)]">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-[var(--muted)]">No recommendations yet. Add your skills and preferred roles for better matches.</p>
          )}
        </Card>

        <div>
          <h2 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight">All open jobs</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Browse every open role — search or filter above to narrow it down.</p>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {jobs.items.map((job) => (
              <PublicJobCard key={job.id} job={job} saveAction={saveJobAction} unsaveAction={unsaveJobAction} redirectTo={redirectTo} />
            ))}
          </div>
        </div>
        <PaginationNav basePath="/candidate/jobs" params={params || {}} meta={jobs.meta} />
    </CareerizAppShell>
  );
}
