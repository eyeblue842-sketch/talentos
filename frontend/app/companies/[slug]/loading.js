export default function CompanyLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8 lg:px-10" aria-busy="true">
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="h-96 animate-pulse rounded-[32px] border border-[var(--line)] bg-white/80" />
        <div className="space-y-6">
          <div className="h-48 animate-pulse rounded-[32px] border border-[var(--line)] bg-white/80" />
          <div className="h-64 animate-pulse rounded-[32px] border border-[var(--line)] bg-white/80" />
        </div>
      </div>
    </main>
  );
}

