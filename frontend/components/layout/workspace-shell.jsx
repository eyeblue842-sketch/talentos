import { Sidebar } from '@/components/layout/sidebar';
import { cn } from '@/lib/utils';

export function WorkspaceShell({
  brand,
  items,
  children,
  className,
  sidebarProfileLinks = [],
  defaultProfileExpanded = false,
  maxWidthClassName = 'max-w-7xl',
  paddingClassName = 'px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8',
  sidebarCollapsible = false,
}) {
  return (
    <main
      className={cn(
        'mx-auto grid min-h-screen gap-6',
        paddingClassName,
        sidebarCollapsible ? 'lg:grid-cols-[64px_1fr]' : 'lg:grid-cols-[272px_1fr]',
        maxWidthClassName,
        className,
      )}
    >
      <Sidebar
        brand={brand}
        items={items}
        profileLinks={sidebarProfileLinks}
        defaultProfileExpanded={defaultProfileExpanded}
        collapsible={sidebarCollapsible}
      />
      <section className="min-w-0 space-y-6">{children}</section>
    </main>
  );
}
