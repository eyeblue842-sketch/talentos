import Link from 'next/link';
import { PaginationNav } from '@/components/sections/pagination-nav';
import { Card } from '@/components/ui/card';

export function MutualConnectionsPanel({
  mutual,
  basePath,
  params = {},
  title = 'Mutual connections',
  emptyLabel = 'No mutual connections yet.',
}) {
  if (!mutual) return null;

  return (
    <Card className="rounded-[32px] p-6">
      <h2 className="font-[var(--font-display)] text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">{mutual.meta.total || 0} shared professional connections.</p>
      <div className="mt-5 grid gap-3">
        {mutual.items.length ? mutual.items.map((item) => (
          <div key={item.userId} className="rounded-2xl border border-[var(--color-border)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--color-text)]">{item.fullName}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {item.designation || item.headline || 'Careeriz professional'}
                  {item.company ? ` • ${item.company}` : ''}
                </p>
              </div>
              <Link href={`/network/people/${item.userId}`} className="text-sm font-semibold text-[var(--color-primary)]">
                View
              </Link>
            </div>
          </div>
        )) : (
          <p className="text-sm text-[var(--color-text-muted)]">{emptyLabel}</p>
        )}
      </div>
      <div className="mt-5">
        <PaginationNav basePath={basePath} params={params} meta={mutual.meta} pageParam="mutualPage" />
      </div>
    </Card>
  );
}
