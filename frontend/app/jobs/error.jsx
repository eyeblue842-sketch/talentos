'use client';

export default function JobsError({ reset }) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-center lg:px-10">
      <div role="alert" className="rounded-[28px] border border-rose-200 bg-white p-8 shadow-[0_18px_48px_rgba(16,36,24,0.07)]">
        <h1 className="font-[var(--font-display)] text-3xl font-semibold">Unable to load jobs</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">The public jobs list could not be loaded right now. Try again.</p>
        <button type="button" onClick={reset} className="mt-5 rounded-full bg-[var(--brand)] px-5 py-3 font-semibold text-white">
          Retry
        </button>
      </div>
    </main>
  );
}

