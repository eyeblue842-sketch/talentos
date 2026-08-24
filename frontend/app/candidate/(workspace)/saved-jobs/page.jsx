import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CareerizAppShell } from '@/components/layout/careeriz-app-shell';
import { Card } from '@/components/ui/card';
import { PaginationNav } from '@/components/sections/pagination-nav';
import { PublicJobCard } from '@/components/sections/public-job-card';
import { candidateNav } from '@/lib/navigation';
import { getCandidateSavedJobs } from '@/lib/api';
import { unsaveJobAction } from '@/app/candidate/actions';
import { buildPathWithQuery, withPage } from '@/lib/query';

export default async function CandidateSavedJobsPage({ searchParams }) {
  const params = await searchParams;
  const savedJobs = await getCandidateSavedJobs(params || {});
  if (String(params?.page || '1') !== String(savedJobs.meta.page)) {
    redirect(buildPathWithQuery('/candidate/saved-jobs', withPage(params || {}, savedJobs.meta.page)));
  }

  return (
    <CareerizAppShell brand="Careeriz" items={candidateNav}>
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">Saved jobs</p>
          <h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold">Keep promising roles in one shortlist</h1>
        </div>
        <form className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Filter</span>
            <select name="filter" defaultValue={params?.filter || 'ALL'} className="rounded-2xl border border-[var(--line)] px-4 py-3">
              <option value="ALL">All</option>
              <option value="OPEN">Open</option>
              <option value="CLOSING_SOON">Closing soon</option>
              <option value="CLOSED">Closed</option>
              <option value="APPLIED">Applied</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Sort</span>
            <select name="sort" defaultValue={params?.sort || 'recently_saved'} className="rounded-2xl border border-[var(--line)] px-4 py-3">
              <option value="recently_saved">Recently saved</option>
              <option value="closing_soon">Closing soon</option>
              <option value="recently_posted">Recently posted</option>
              <option value="job_title">Job title</option>
            </select>
          </label>
          <button type="submit" className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white sm:col-span-2">Apply filters</button>
        </form>
        {savedJobs.items.length ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {savedJobs.items.map((item) => (
              item.job ? (
                <PublicJobCard key={item.id} job={{ ...item.job, saved: true }} unsaveAction={unsaveJobAction} redirectTo="/candidate/saved-jobs" />
              ) : (
                <Card key={item.id} className="rounded-[28px] p-6">
                  <h2 className="font-[var(--font-display)] text-2xl font-semibold">{item.snapshot.title}</h2>
                  <p className="mt-2 text-sm text-[var(--muted)]">{item.snapshot.organisationName}</p>
                  <p className="mt-4 text-sm text-[var(--muted)]">This saved job is no longer publicly available, but the history has been preserved.</p>
                </Card>
              )
            ))}
          </div>
        ) : (
          <Card className="rounded-[28px] p-10 text-center">
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">No saved jobs yet</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Save jobs from listings or job detail pages to revisit them later.</p>
            <Link href="/candidate/jobs" className="mt-5 inline-flex rounded-full bg-[var(--brand)] px-5 py-3 font-semibold text-white">Browse jobs</Link>
          </Card>
        )}
        <PaginationNav basePath="/candidate/saved-jobs" params={params || {}} meta={savedJobs.meta} />
    </CareerizAppShell>
  );
}
