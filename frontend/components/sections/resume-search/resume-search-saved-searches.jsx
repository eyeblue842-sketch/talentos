"use client";

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ResumeSearchSavedSearches({ items = [], onFill, canManage = false, onSaveCurrent, hasCriteria = false, bare = false }) {
  const Wrapper = bare ? 'div' : Card;
  return (
    <Wrapper>
      <div className="flex items-center justify-between gap-2">
        {bare ? null : <h3 className="text-sm font-semibold text-[var(--color-text)]">Saved Searches</h3>}
        {canManage ? (
          <Button type="button" variant="link" size="sm" className="min-h-0" disabled={!hasCriteria} onClick={onSaveCurrent}>
            Save current
          </Button>
        ) : null}
      </div>
      {items.length ? (
        <ul className={cn('space-y-2', !bare && 'mt-3')}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onFill(item)}
                className="flex w-full flex-col items-start rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2.5 text-left hover:border-[var(--color-primary)]"
              >
                <span className="text-sm font-medium text-[var(--color-text)]">{item.name}</span>
                <span className="mt-1 text-xs text-[var(--color-text-muted)]">{item.description || item.rawQuery || 'Saved recruiter search'}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn('text-sm text-[var(--color-text-muted)]', !bare && 'mt-3')}>Saved searches appear here after you save the current criteria.</p>
      )}
    </Wrapper>
  );
}
