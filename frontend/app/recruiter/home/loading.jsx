import { CareerizAppShell } from '@/components/layout/careeriz-app-shell';
import { CardSkeleton, MetricSkeleton } from '@/components/ui/skeleton';
import { recruiterNav } from '@/lib/navigation';

export default function Loading() {
  return (
    <CareerizAppShell brand="Careeriz Hire" items={recruiterNav}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
      </div>
      <CardSkeleton />
      <CardSkeleton />
    </CareerizAppShell>
  );
}
