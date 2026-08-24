import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { CardSkeleton, TableRowSkeleton } from '@/components/ui/skeleton';
import { recruiterNav } from '@/lib/navigation';

export default function Loading() {
  return (
    <WorkspaceShell brand="Careeriz Hire" items={recruiterNav} sidebarCollapsible>
      <CardSkeleton />
      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <CardSkeleton />
        <div className="space-y-4">
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
        </div>
        <CardSkeleton />
      </div>
    </WorkspaceShell>
  );
}
