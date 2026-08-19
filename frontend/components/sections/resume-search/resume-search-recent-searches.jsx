"use client";

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatSemanticSearchDate } from '@/lib/semantic-search';

function summarizeRecentSearch(entry) {
  const query = entry.query || {};
  const parts = [
    entry.rawQuery || entry.normalizedQuery,
    query.locations?.length ? query.locations.join(', ') : null,
    (query.minExperience != null || query.maxExperience != null) ? `${query.minExperience ?? 0}-${query.maxExperience ?? 'Any'} yrs` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' | ') : 'Recruiter search';
}

export function ResumeSearchRecentSearches({ items = [], onFill, onExecute, bare = false }) {
  const Wrapper = bare ? 'div' : Card;
  return (
    <Wrapper>
      {bare ? null : <h3 className="text-sm font-semibold text-[var(--color-text)]">Recent Searches</h3>}
      {items.length ? (
        <ul className={cn('space-y-2', !bare && 'mt-3')}>
          {items.map((item) => (
            <li key={item.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2.5">
              <p className="text-sm font-medium text-[var(--color-text)]">{summarizeRecentSearch(item)}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{formatSemanticSearchDate(item.createdAt)}</p>
              <div className="mt-2 flex gap-3 text-xs font-semibold">
                <button type="button" onClick={() => onFill(item)} className="text-[var(--color-primary)] hover:underline">Fill this search</button>
                <button type="button" onClick={() => onExecute(item)} className="text-[var(--color-primary)] hover:underline">Search profiles</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn('text-sm text-[var(--color-text-muted)]', !bare && 'mt-3')}>Recent searches appear here after your first Resume Search.</p>
      )}
    </Wrapper>
  );
}
