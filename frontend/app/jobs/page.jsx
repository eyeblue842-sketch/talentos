import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PublicJobCard } from '@/components/sections/public-job-card';
import { PaginationNav } from '@/components/sections/pagination-nav';
import { PublicJobSearchForm } from '@/components/sections/public-job-search-form';
import { getCurrentUser } from '@/lib/auth';
import { getPublicJobs } from '@/lib/api';
import { saveJobAction, unsaveJobAction } from '@/app/candidate/actions';
import { buildPathWithQuery, buildSearchParams, withPage } from '@/lib/query';

export const metadata = {
  title: 'Browse Jobs | Careeriz',
  description: 'Search open public jobs on Careeriz by role, skill, location, workplace type, and company.',
};

export default async function PublicJobsPage({ searchParams }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const result = await getPublicJobs(params || {});
  if (String(params?.page || '1') !== String(result.meta.page)) {
    redirect(buildPathWithQuery('/jobs', withPage(params || {}, result.meta.page)));
  }
  const redirectTo = buildPathWithQuery('/jobs', params || {});

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8 lg:px-10">
      <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_18px_55px_rgba(16,36,24,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Public jobs</p>
        <h1 className="mt-3 font-[var(--font-display)] text-4xl font-semibold">Find the right next role</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">Search live jobs with transparent filters, stable URLs, and public-safe company details.</p>
        <div className="mt-6">
          <PublicJobSearchForm searchParams={params || {}} />
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-[var(--muted)]">{result.meta.total} public jobs found</p>
          {!user || user.role !== 'CANDIDATE' ? (
            <Link href="/auth/candidate/login" className="text-sm font-semibold text-[var(--brand)]">Sign in to save jobs</Link>
          ) : null}
        </div>
        {result.items.length ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {result.items.map((job) => (
              <PublicJobCard
                key={job.id}
                job={job}
                saveAction={user?.role === 'CANDIDATE' ? saveJobAction : null}
                unsaveAction={user?.role === 'CANDIDATE' ? unsaveJobAction : null}
                redirectTo={redirectTo}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[28px] border border-dashed border-[var(--line)] bg-white p-10 text-center">
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">No jobs matched these filters</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Clear one or more filters to widen the search.</p>
          </div>
        )}
        <PaginationNav basePath="/jobs" params={params || {}} meta={result.meta} />
      </section>
    </main>
  );
}
