import { notFound } from 'next/navigation';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { PaginationNav } from '@/components/sections/pagination-nav';
import { PublicJobCard } from '@/components/sections/public-job-card';
import { PublicJobSearchForm } from '@/components/sections/public-job-search-form';
import { getCurrentUser } from '@/lib/auth';
import { getPublicOrganisation } from '@/lib/api';
import { saveJobAction, unsaveJobAction } from '@/app/candidate/actions';
import { buildPathWithQuery, withPage } from '@/lib/query';

export async function generateMetadata({ params }) {
  try {
    const data = await getPublicOrganisation((await params).slug);
    return {
      title: `${data.organisation.name} Careers | Careeriz`,
      description: data.organisation.publicDescription || `Browse public jobs from ${data.organisation.name} on Careeriz.`,
      alternates: { canonical: `/companies/${data.organisation.slug}` },
    };
  } catch {
    return { title: 'Company not found | Careeriz' };
  }
}

export default async function PublicOrganisationPage({ params, searchParams }) {
  const routeParams = await params;
  const queryParams = await searchParams;
  let data;
  try {
    data = await getPublicOrganisation(routeParams.slug, queryParams);
  } catch (error) {
    if (error.statusCode === 404) notFound();
    throw error;
  }

  const user = await getCurrentUser();
  const { organisation, jobs } = data;
  if (String(queryParams?.page || '1') !== String(jobs.meta.page)) {
    redirect(buildPathWithQuery(`/companies/${organisation.slug}`, withPage(queryParams || {}, jobs.meta.page)));
  }
  const redirectTo = buildPathWithQuery(`/companies/${organisation.slug}`, queryParams || {});

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8 lg:px-10">
      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <Card className="rounded-[32px] p-7">
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--brand)]">Company careers</p>
          <h1 className="mt-3 font-[var(--font-display)] text-4xl font-semibold">{organisation.name}</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{organisation.publicDescription || 'This employer has published a public careers page on Careeriz.'}</p>
          <dl className="mt-6 grid gap-4 text-sm text-[var(--muted)]">
            <div><dt className="font-semibold text-[var(--text)]">Industry</dt><dd>{organisation.industry || 'Not disclosed'}</dd></div>
            <div><dt className="font-semibold text-[var(--text)]">Organisation size</dt><dd>{organisation.organisationSize || 'Not disclosed'}</dd></div>
            <div><dt className="font-semibold text-[var(--text)]">Headquarters</dt><dd>{organisation.headquarters || 'Not disclosed'}</dd></div>
            <div><dt className="font-semibold text-[var(--text)]">Locations</dt><dd>{organisation.publicLocations.length ? organisation.publicLocations.join(', ') : 'Not disclosed'}</dd></div>
          </dl>
          {organisation.cultureSummary ? <p className="mt-6 text-sm leading-7 text-[var(--muted)]">{organisation.cultureSummary}</p> : null}
          {organisation.benefitsSummary ? <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{organisation.benefitsSummary}</p> : null}
        </Card>
        <div className="space-y-6">
          <PublicJobSearchForm action={`/companies/${organisation.slug}`} searchParams={queryParams} organisationLocked />
          {jobs.items.length ? jobs.items.map((job) => (
            <PublicJobCard
              key={job.id}
              job={job}
              saveAction={user?.role === 'CANDIDATE' ? saveJobAction : null}
              unsaveAction={user?.role === 'CANDIDATE' ? unsaveJobAction : null}
              redirectTo={redirectTo}
            />
          )) : (
            <Card className="rounded-[32px] p-8 text-center text-[var(--muted)]">
              No open public jobs are listed for this organisation right now.
            </Card>
          )}
          <PaginationNav basePath={`/companies/${organisation.slug}`} params={queryParams || {}} meta={jobs.meta} />
        </div>
      </section>
    </main>
  );
}
