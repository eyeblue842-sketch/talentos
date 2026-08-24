import { redirect } from 'next/navigation';
import { CareerizAppShell } from '@/components/layout/careeriz-app-shell';
import { PaginationNav } from '@/components/sections/pagination-nav';
import { PublicJobCard } from '@/components/sections/public-job-card';
import { PublicJobSearchForm } from '@/components/sections/public-job-search-form';
import { Card } from '@/components/ui/card';
import { getCandidateRecommendations, getPublicJobs } from '@/lib/api';
import { candidateNav } from '@/lib/navigation';
import { saveJobAction, unsaveJobAction } from '@/app/candidate/actions';
import { buildPathWithQuery, withPage } from '@/lib/query';

export default async function CandidateJobsPage({ searchParams }) {
  const params = await searchParams;
  const [jobs, recommendations] = await Promise.all([
    getPublicJobs(params || {}),
    getCandidateRecommendations(),
  ]);
  if (String(params?.page || '1') !== String(jobs.meta.page)) {
    redirect(buildPathWithQuery('/candidate/jobs', withPage(params || {}, jobs.meta.page)));
  }
  const redirectTo = buildPathWithQuery('/candidate/jobs', params || {});

  return (
    <CareerizAppShell brand="Careeriz" items={candidateNav}>
        <Card className="rounded-[32px] bg-[var(--surface)] p-6 shadow-[0_20px_60px_rgba(16,36,24,0.08)] md:p-7">
          <h1 className="font-[var(--font-display)] text-4xl font-semibold tracking-tight">Browse jobs</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Search the public job market, save roles, and compare them against deterministic recommendations.</p>
          <div className="mt-6">
            <PublicJobSearchForm action="/candidate/jobs" searchParams={params || {}} />
          </div>
        </Card>

        <Card className="rounded-[30px] bg-white p-6 shadow-[0_18px_48px_rgba(16,36,24,0.07)]">
          <h2 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight">Recommended for you</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{recommendations.prompt || 'Based on your current profile and public job availability.'}</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {recommendations.recommendedJobs.map((job) => (
              <PublicJobCard key={job.id} job={job} saveAction={saveJobAction} unsaveAction={unsaveJobAction} redirectTo="/candidate/jobs" />
            ))}
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          {jobs.items.map((job) => (
            <PublicJobCard key={job.id} job={job} saveAction={saveJobAction} unsaveAction={unsaveJobAction} redirectTo={redirectTo} />
          ))}
        </div>
        <PaginationNav basePath="/candidate/jobs" params={params || {}} meta={jobs.meta} />
    </CareerizAppShell>
  );
}
