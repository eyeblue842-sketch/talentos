import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { PublicHeader } from '@/components/public/public-header';
import { Card } from '@/components/ui/card';
import { getPublicOrganisations } from '@/lib/api';

function formatSlug(slug) {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default async function CompaniesPage() {
  const organisations = await getPublicOrganisations();

  return (
    <>
      <PublicHeader />
      <main className="mx-auto min-h-screen max-w-7xl px-6 py-8 lg:px-10">
        <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-md)] md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">Companies</p>
          <h1 className="mt-4 font-[var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--color-text)]">
            Explore employer career pages.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-text-secondary)]">
            Browse public company career pages with live openings and candidate-safe employer details.
          </p>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {organisations.length ? organisations.map((organisation) => (
            <Card key={organisation.slug} variant="interactive" className="p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <Building2 size={20} aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-[var(--color-text)]">{formatSlug(organisation.slug)}</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">
                Open the public company page to review available jobs and employer details.
              </p>
              <Link href={`/companies/${organisation.slug}`} className="mt-5 inline-flex font-semibold text-[var(--color-primary)]">
                View careers page
              </Link>
            </Card>
          )) : (
            <Card variant="outlined" className="p-8 text-center text-[var(--color-text-muted)] md:col-span-2 xl:col-span-3">
              Company pages will appear here as employers publish public career profiles.
            </Card>
          )}
        </section>
      </main>
    </>
  );
}
