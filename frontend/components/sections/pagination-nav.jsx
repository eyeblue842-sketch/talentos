import Link from 'next/link';
import clsx from 'clsx';
import { buildPathWithQuery, withPage } from '@/lib/query';

function buildPageList(currentPage, pageCount) {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (currentPage >= pageCount - 2) {
    pages.add(pageCount - 1);
    pages.add(pageCount - 2);
    pages.add(pageCount - 3);
  }

  return [...pages]
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((a, b) => a - b);
}

export function PaginationNav({ basePath, params = {}, meta }) {
  if (!meta || meta.pageCount <= 1) return null;

  const pages = buildPageList(meta.page, meta.pageCount);
  const items = [];
  let previous = 0;

  for (const page of pages) {
    if (previous && page - previous > 1) {
      items.push({ type: 'gap', key: `gap-${page}` });
    }
    items.push({ type: 'page', value: page, key: `page-${page}` });
    previous = page;
  }

  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[var(--muted)]">
        Page {meta.page} of {meta.pageCount}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {meta.page === 1 ? (
          <span className="cursor-not-allowed rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--muted)] opacity-60">
            Previous
          </span>
        ) : (
          <Link
            href={buildPathWithQuery(basePath, withPage(params, meta.page - 1))}
            className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
          >
            Previous
          </Link>
        )}
        {items.map((item) => {
          if (item.type === 'gap') {
            return (
              <span key={item.key} className="px-2 text-sm text-[var(--muted)]">
                …
              </span>
            );
          }

          const active = item.value === meta.page;

          return (
            <Link
              key={item.key}
              href={buildPathWithQuery(basePath, withPage(params, item.value))}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'min-w-10 rounded-full border px-4 py-2 text-center text-sm font-semibold transition',
                active
                  ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                  : 'border-[var(--line)] text-[var(--text)] hover:border-[var(--brand)] hover:text-[var(--brand)]',
              )}
            >
              {item.value}
            </Link>
          );
        })}
        {meta.page === meta.pageCount ? (
          <span className="cursor-not-allowed rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--muted)] opacity-60">
            Next
          </span>
        ) : (
          <Link
            href={buildPathWithQuery(basePath, withPage(params, meta.page + 1))}
            className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
          >
            Next
          </Link>
        )}
      </div>
    </nav>
  );
}
