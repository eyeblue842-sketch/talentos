import Link from 'next/link';
import { PublicFooter } from '@/components/public/public-footer';
import { PublicHeader } from '@/components/public/public-header';

export default function PublicResumeBuilderEntry() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-8 lg:px-10">
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-[32px] border border-[var(--line)] bg-white p-8 shadow-[0_18px_48px_rgba(16,36,24,0.07)]">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--brand)]">Product separation</p>
            <h1 className="mt-3 font-[var(--font-display)] text-4xl font-semibold">Resume Builder is a separate standalone product.</h1>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              Careeriz does not provide a native resume editor. Candidates can upload resumes into Careeriz, then use the standalone Resume Builder through a future deep-link, SSO, or API integration boundary.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/candidate" className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Candidate access</Link>
              <Link href="/jobs" className="rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold text-[var(--text)]">Browse jobs</Link>
            </div>
          </section>

          <section className="rounded-[32px] border border-[var(--line)] bg-[var(--surface)] p-8">
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">What Careeriz handles today</h2>
            <div className="mt-5 space-y-3 text-sm text-[var(--muted)]">
              <p>Resume upload and secure storage</p>
              <p>Resume parsing status and metadata</p>
              <p>Resume selection during job application</p>
              <p>External Resume Builder launch points</p>
              <p>Future integration boundaries for SSO and resume synchronization</p>
            </div>
          </section>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
