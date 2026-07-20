import { cn } from '@/lib/utils';

export function Skeleton({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-[var(--radius-md)] bg-[linear-gradient(90deg,#eef2ff_0%,#f8fafc_50%,#eef2ff_100%)] bg-[length:200%_100%] motion-reduce:animate-none', className)}
    />
  );
}

export function TextSkeleton({ lines = 3 }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn('h-4', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="grid gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5">
      <Skeleton className="h-5 w-1/3" />
      <TextSkeleton />
      <Skeleton className="h-10 w-28" />
    </div>
  );
}

export function TableRowSkeleton({ columns = 5 }) {
  return (
    <div className="grid grid-cols-1 gap-3 border-b border-[var(--color-border)] py-4 md:grid-cols-5">
      {Array.from({ length: columns }, (_, index) => (
        <Skeleton key={index} className="h-4 w-full" />
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-[auto_1fr]">
      <Skeleton className="h-16 w-16 rounded-full" />
      <div className="grid gap-3">
        <Skeleton className="h-5 w-40" />
        <TextSkeleton lines={2} />
      </div>
    </div>
  );
}

export function MetricSkeleton() {
  return (
    <div className="grid gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}
