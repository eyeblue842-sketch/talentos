export default function JobDetailLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8 lg:px-10" aria-busy="true">
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="h-96 animate-pulse rounded-[32px] border border-[var(--line)] bg-white/80" />
        <div className="space-y-6">
          <div className="h-40 animate-pulse rounded-[32px] border border-[var(--line)] bg-white/80" />
          <div className="h-56 animate-pulse rounded-[32px] border border-[var(--line)] bg-white/80" />
        </div>
      </div>
    </main>
  );
}

