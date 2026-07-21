import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { ApplicationsList } from '@/components/sections/applications-list';
import { PaginationNav } from '@/components/sections/pagination-nav';
import { candidateNav } from '@/lib/navigation';
import { getCandidateApplications } from '@/lib/api';
import { buildPathWithQuery, withPage } from '@/lib/query';

export default async function CandidateApplicationsPage({ searchParams }) {
  const params = await searchParams;
  const applications = await getCandidateApplications(params || {});
  if (String(params?.page || '1') !== String(applications.meta.page)) {
    redirect(buildPathWithQuery('/candidate/applications', withPage(params || {}, applications.meta.page)));
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10">
      <Sidebar brand="Careeriz" items={candidateNav} />
      <section className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">My applications</p>
            <h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold">Track every stage after you apply</h1>
          </div>
          <form className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Filter</span>
              <select name="filter" defaultValue={params?.filter || 'ALL'} className="rounded-2xl border border-[var(--line)] px-4 py-3">
                <option value="ALL">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INTERVIEW">Interview</option>
                <option value="OFFER">Offer</option>
                <option value="CLOSED">Closed</option>
                <option value="WITHDRAWN">Withdrawn</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Sort</span>
              <select name="sort" defaultValue={params?.sort || 'recently_updated'} className="rounded-2xl border border-[var(--line)] px-4 py-3">
                <option value="recently_updated">Most recently updated</option>
                <option value="recently_applied">Most recently applied</option>
                <option value="oldest">Oldest</option>
                <option value="job_title">Job title</option>
              </select>
            </label>
            <button type="submit" className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white sm:col-span-2">Apply filters</button>
          </form>
        </div>
        {applications.items.length ? (
          <ApplicationsList
            applications={applications.items.map((application) => ({
              id: application.id,
              role: application.job.title,
              company: application.job.organisation?.name || 'Careeriz employer',
              location: application.job.location || application.job.slug,
              summary: `Reference ${application.publicReference}${application.resume?.filename ? ` | Resume ${application.resume.filename}` : ''}`,
              tone: application.stage === 'APPLICATION_CLOSED' ? 'neutral' : application.stage === 'SELECTED' ? 'success' : application.stage === 'APPLICATION_WITHDRAWN' ? 'warning' : 'brand',
              status: application.status,
              stage: application.stage,
              reference: application.publicReference,
              latestUpdate: application.latestUpdate || 'No visible updates yet.',
              href: `/candidate/applications/${application.id}`,
              date: new Date(application.submittedAt).toLocaleDateString(),
            }))}
          />
        ) : (
          <div className="rounded-[28px] border border-[var(--line)] bg-white p-10 text-center">
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">You have not applied to any jobs yet.</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Browse open opportunities to get started.</p>
          </div>
        )}
        <PaginationNav basePath="/candidate/applications" params={params || {}} meta={applications.meta} />
      </section>
    </main>
  );
}
