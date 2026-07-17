export default function CandidateLoading() {
  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-10" aria-busy="true">
      <div className="h-[70vh] animate-pulse rounded-[28px] border border-[var(--line)] bg-[#102418]" />
      <section className="space-y-6">
        <div className="h-24 animate-pulse rounded-[28px] border border-[var(--line)] bg-white/80" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-[24px] border border-[var(--line)] bg-white/80" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-[24px] border border-[var(--line)] bg-white/80" />
      </section>
    </main>
  );
}

