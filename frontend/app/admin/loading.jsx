import { CareerizAppShell } from '@/components/layout/careeriz-app-shell';
import { CardSkeleton, MetricSkeleton } from '@/components/ui/skeleton';
import { adminNav } from '@/lib/navigation';

export default function Loading() {
  return (
    <CareerizAppShell brand="Enterprise Admin" items={adminNav}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </CareerizAppShell>
  );
}
