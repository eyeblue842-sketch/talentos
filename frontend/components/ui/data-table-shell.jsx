import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { TableRowSkeleton } from '@/components/ui/skeleton';
import { SearchInput } from '@/components/ui/form-layout';

export function DataTableShell({
  title,
  description,
  searchPlaceholder,
  filters,
  emptyState,
  loading = false,
  pagination,
  children,
}) {
  return (
    <Card>
      {(title || description) ? (
        <div className="flex flex-col gap-2 border-b border-[var(--color-border)] pb-4">
          {title ? <h3 className="text-xl font-semibold text-[var(--color-text)]">{title}</h3> : null}
          {description ? <p className="text-sm text-[var(--color-text-muted)]">{description}</p> : null}
        </div>
      ) : null}
      {(searchPlaceholder || filters) ? (
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {searchPlaceholder ? (
            <SearchInput
              aria-label="Search table"
              placeholder={searchPlaceholder}
              className="max-w-md"
            />
          ) : <div />}
          {filters ? <div className="flex flex-wrap items-center gap-3">{filters}</div> : null}
        </div>
      ) : null}
      <div className="mt-5 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white">
        {loading ? (
          <div className="p-4">
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
          </div>
        ) : emptyState ? (
          <div className="p-4">
            <EmptyState {...emptyState} />
          </div>
        ) : children}
      </div>
      {pagination ? <div className="mt-4">{pagination}</div> : null}
    </Card>
  );
}
