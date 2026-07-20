import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { MetricSkeleton } from '@/components/ui/skeleton';

export function StatCard({ label, value, helper, icon: Icon, trend, loading = false }) {
  if (loading) {
    return <MetricSkeleton />;
  }

  const TrendIcon = trend?.direction === 'down' ? ArrowDownRight : ArrowUpRight;

  return (
    <Card variant="interactive" className="bg-[var(--surface)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-text)]">{value}</p>
        </div>
        {Icon ? (
          <span className="rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] p-2 text-[var(--color-primary)]">
            <Icon size={18} aria-hidden="true" />
          </span>
        ) : null}
      </div>
      {(trend || helper) ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          {trend ? (
            <span className={trend.direction === 'down' ? 'inline-flex items-center gap-1 text-[var(--color-danger)]' : 'inline-flex items-center gap-1 text-[var(--color-success)]'}>
              <TrendIcon size={15} aria-hidden="true" />
              {trend.value}
            </span>
          ) : null}
          {helper ? <span className="text-[var(--color-text-muted)]">{helper}</span> : null}
        </div>
      ) : null}
    </Card>
  );
}

