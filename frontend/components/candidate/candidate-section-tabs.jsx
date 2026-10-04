"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// A pill tab bar made of links, used to group related candidate pages
// (e.g. Find Jobs / Saved / Applications / Interviews / Offers) into one
// tabbed experience while each tab keeps its own route and data.
export function CandidateSectionTabs({ tabs = [] }) {
  const pathname = usePathname();

  return (
    <div role="tablist" aria-label="Section tabs" className="inline-flex w-full flex-wrap gap-2 rounded-[var(--radius-pill)] bg-[var(--color-bg-muted)] p-1">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-[var(--radius-pill)] px-4 py-2 text-sm font-semibold transition',
              active
                ? 'bg-white text-[var(--color-primary)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
