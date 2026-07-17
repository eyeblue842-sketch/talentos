import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
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
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Careeriz" items={candidateNav} />
      <section className="space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">Saved jobs</p>
          <h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold">Keep promising roles in one shortlist</h1>
        </div>
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
      </section>
    </main>
  );
}
