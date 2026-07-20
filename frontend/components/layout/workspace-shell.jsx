import { Sidebar } from '@/components/layout/sidebar';
import { cn } from '@/lib/utils';

export function WorkspaceShell({ brand, items, children, className }) {
  return (
    <main className={cn('mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[280px_1fr] lg:px-10 lg:py-8', className)}>
      <Sidebar brand={brand} items={items} />
      <section className="min-w-0 space-y-6">{children}</section>
    </main>
  );
}
