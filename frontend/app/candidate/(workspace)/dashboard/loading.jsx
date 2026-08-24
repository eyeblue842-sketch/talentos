import { CareerizAppShell } from '@/components/layout/careeriz-app-shell';
import { CardSkeleton, MetricSkeleton, ProfileSkeleton } from '@/components/ui/skeleton';
import { candidateNav } from '@/lib/navigation';

export default function Loading() {
  return (
    <CareerizAppShell brand="Careeriz" items={candidateNav} sidebarCollapsible>
      <ProfileSkeleton />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
