import { PageHeader } from '@/components/ui/page-header';
import { Sidebar } from '@/components/layout/sidebar';
import { cn } from '@/lib/utils';

// The single authenticated application shell every workspace route enters
// through. `items` is always computed server-side (see lib/navigation.js's
// getNavigationForRole) by the calling Server Component page/layout - this
// component only renders what it is given, and never decides on its own
// which routes a role may reach. Visiting a route the caller's role
// shouldn't reach is still stopped by the existing server-side requireUser()
// guards regardless of what the nav shows, so nav visibility here is
// display-only and is never a substitute for server authorization.
export function CareerizAppShell({
  brand,
  items,
  children,
  className,
  sidebarProfileLinks = [],
  defaultProfileExpanded = false,
  maxWidthClassName = 'max-w-7xl',
  paddingClassName = 'px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8',
  sidebarCollapsible = false,
  rightContext = null,
  pageTitle,
  pageDescription,
  breadcrumb,
  primaryAction,
  secondaryActions,
}) {
  const hasHeader = Boolean(pageTitle || breadcrumb?.length);
  const header = hasHeader ? (
    <PageHeader
      title={pageTitle}
      description={pageDescription}
      breadcrumb={breadcrumb}
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
    />
  ) : null;

  return (
    <main
      className={cn(
        'mx-auto grid min-h-screen gap-6',
        paddingClassName,
        sidebarCollapsible ? 'lg:grid-cols-[var(--shell-width-collapsed)_1fr]' : 'lg:grid-cols-[var(--shell-width-expanded)_1fr]',
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
      {rightContext ? (
        <section className="min-w-0 space-y-6 xl:grid xl:grid-cols-[1fr_var(--shell-width-context-rail)] xl:items-start xl:gap-6 xl:space-y-0">
          <div className="space-y-6">
            {header}
            {children}
          </div>
          <aside className="space-y-4">{rightContext}</aside>
        </section>
      ) : (
        <section className="min-w-0 space-y-6">
          {header}
          {children}
        </section>
      )}
    </main>
  );
}
