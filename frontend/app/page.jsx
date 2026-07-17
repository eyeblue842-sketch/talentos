import Link from 'next/link';
import { ArrowRight, Building2, Search, Sparkles } from 'lucide-react';
import { PublicJobCard } from '@/components/sections/public-job-card';
import { PublicJobSearchForm } from '@/components/sections/public-job-search-form';
import { getPublicPortal } from '@/lib/api';

export default async function HomePage() {
  const portal = await getPublicPortal();

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-10">
      <header className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_18px_55px_rgba(16,36,24,0.08)] md:p-8">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--brand)]">Careeriz</p>
              <h1 className="mt-3 font-[var(--font-display)] text-4xl font-semibold tracking-tight md:text-6xl">
                Discover public jobs from teams building with urgency and clarity.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)] md:text-lg">
                Search real openings, compare workplaces and experience bands, save roles for later, and manage your candidate journey in one recruitment operating system.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/jobs" className="inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)]">
                Browse jobs <ArrowRight size={16} />
              </Link>
              <Link href="/auth" className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-5 py-3 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]">
                Candidate sign in
              </Link>
            </div>
          </div>
          <PublicJobSearchForm action="/jobs" searchParams={{}} />
        </div>
      </header>

      <section className="mt-8 grid gap-5 lg:grid-cols-3">
        <div className="rounded-[28px] border border-[var(--line)] bg-white p-6 shadow-[0_14px_45px_rgba(16,36,24,0.06)]">
          <Search className="text-[var(--brand)]" size={20} />
          <h2 className="mt-4 font-[var(--font-display)] text-2xl font-semibold">Search with context</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Filter by skills, location, workplace type, experience, and company without losing shareable URLs.</p>
        </div>
        <div className="rounded-[28px] border border-[var(--line)] bg-white p-6 shadow-[0_14px_45px_rgba(16,36,24,0.06)]">
          <Building2 className="text-[var(--brand)]" size={20} />
          <h2 className="mt-4 font-[var(--font-display)] text-2xl font-semibold">Explore company careers pages</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Review open roles alongside each organisation’s public story, locations, and culture summary.</p>
        </div>
        <div className="rounded-[28px] border border-[var(--line)] bg-white p-6 shadow-[0_14px_45px_rgba(16,36,24,0.06)]">
          <Sparkles className="text-[var(--brand)]" size={20} />
          <h2 className="mt-4 font-[var(--font-display)] text-2xl font-semibold">Candidate dashboard foundation</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Save jobs, track activity, and complete your profile for deterministic recommendations.</p>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Latest jobs</p>
            <h2 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">Fresh public openings</h2>
          </div>
          <Link href="/jobs" className="text-sm font-semibold text-[var(--brand)]">View all jobs</Link>
        </div>
        {portal.latestJobs.length ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {portal.latestJobs.map((job) => (
              <PublicJobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[28px] border border-dashed border-[var(--line)] bg-white p-10 text-center text-[var(--muted)]">
            Public jobs will appear here once organisations publish active openings.
          </div>
        )}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] border border-[var(--line)] bg-white p-6 shadow-[0_14px_45px_rgba(16,36,24,0.06)]">
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Popular job categories</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            {portal.categories.length ? portal.categories.map((category) => (
              <Link key={category.label} href={`/jobs?skills=${encodeURIComponent(category.label)}`} className="rounded-full bg-[var(--soft)] px-4 py-2 text-sm font-semibold text-[var(--brand)]">
                {category.label} · {category.count}
              </Link>
            )) : <p className="text-sm text-[var(--muted)]">Categories will populate from real published jobs.</p>}
          </div>
        </div>
        <div className="rounded-[28px] border border-[var(--line)] bg-white p-6 shadow-[0_14px_45px_rgba(16,36,24,0.06)]">
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Popular locations</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            {portal.locations.length ? portal.locations.map((location) => (
              <Link key={location} href={`/jobs?location=${encodeURIComponent(location)}`} className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--text)]">
                {location}
              </Link>
            )) : <p className="text-sm text-[var(--muted)]">Locations will appear from public jobs once published.</p>}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {portal.workplaceTypes.map((type) => (
              <Link key={type} href={`/jobs?workplaceType=${type}`} className="rounded-full bg-[#102418] px-4 py-2 text-sm font-semibold text-white">
                {type.replaceAll('_', ' ')}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}


