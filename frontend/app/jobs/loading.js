export default function JobsLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8 lg:px-10" aria-busy="true">
      <div className="h-48 animate-pulse rounded-[32px] border border-[var(--line)] bg-white/80" />
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-64 animate-pulse rounded-[28px] border border-[var(--line)] bg-white/80" />
        ))}
      </div>
    </main>
  );
}

