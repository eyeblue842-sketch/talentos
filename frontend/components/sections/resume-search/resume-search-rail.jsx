"use client";

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, History, Pin, PinOff, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResumeSearchRecentSearches } from './resume-search-recent-searches';
import { ResumeSearchSavedSearches } from './resume-search-saved-searches';

/**
 * Compact collapsed rail (~52px) that expands into a ~320px overlay panel on
 * click OR hover - never only hover, so keyboard and touch users can reach it
 * the same way. A pin keeps it open explicitly. Expanding overlays the form
 * (position: absolute) instead of resizing the grid, so the search form never
 * shifts width when the rail opens.
 */
export function ResumeSearchRail({
  recentItems,
  onFillRecent,
  onExecuteRecent,
  savedItems,
  onFillSaved,
  canManageSaved,
  hasCriteria,
  onSaveCurrent,
}) {
  const [expanded, setExpanded] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [tab, setTab] = useState('recent');
  const containerRef = useRef(null);
  // The collapsed rail and the expanded panel's own controls occupy the same
  // top-right corner, so an explicit collapse click can land the cursor right
  // back on the (now-revealed) collapsed rail, and some browsers re-fire
  // mouseenter on that DOM swap even without real pointer movement. Suppress
  // hover-driven reopen for a moment after any explicit collapse so that
  // never undoes the click that just happened.
  const suppressHoverUntilRef = useRef(0);

  function collapse() {
    suppressHoverUntilRef.current = Date.now() + 400;
    setPinned(false);
    setExpanded(false);
  }

  useEffect(() => {
    if (!expanded || pinned) return undefined;
    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) collapse();
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [expanded, pinned]);

  useEffect(() => {
    if (!expanded) return undefined;
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !pinned) collapse();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [expanded, pinned]);

  return (
    <div
      ref={containerRef}
      className="relative"
      // Hover only ever opens, never auto-closes: closing is always an explicit
      // action (collapse button, outside click, or Escape) so it can never
      // race with - or immediately undo - a real click on the panel itself.
      onMouseEnter={() => {
        if (pinned || Date.now() < suppressHoverUntilRef.current) return;
        setExpanded(true);
      }}
    >
      <div
        className={cn(
          'flex w-14 flex-col items-center gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white py-3 shadow-[var(--shadow-md)]',
          expanded && 'invisible',
        )}
      >
        <button
          type="button"
          aria-expanded={expanded}
          aria-label="Open Recent and Saved Searches"
          onClick={() => { setTab('recent'); setExpanded(true); }}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"
        >
          <History size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-expanded={expanded}
          aria-label="Open Saved Searches"
          onClick={() => { setTab('saved'); setExpanded(true); }}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"
        >
          <Save size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Expand search rail"
          onClick={() => setExpanded(true)}
          className="mt-1 flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-muted)]"
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
      </div>

      {expanded ? (
        <div className="absolute right-0 top-0 z-20 w-[320px] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-floating)]">
          <div className="flex items-center justify-between gap-2">
            <div role="tablist" aria-label="Search history" className="inline-flex overflow-hidden rounded-full border border-[var(--color-border)]">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'recent'}
                onClick={() => setTab('recent')}
                className={cn('px-3 py-1.5 text-xs font-semibold', tab === 'recent' ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-[var(--color-text-secondary)]')}
              >
                Recent
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'saved'}
                onClick={() => setTab('saved')}
                className={cn('px-3 py-1.5 text-xs font-semibold', tab === 'saved' ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-[var(--color-text-secondary)]')}
              >
                Saved
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-pressed={pinned}
                aria-label={pinned ? 'Unpin panel' : 'Pin panel open'}
                onClick={() => setPinned((current) => !current)}
                className={cn('flex h-7 w-7 items-center justify-center rounded-full', pinned ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-muted)]')}
              >
                {pinned ? <PinOff size={14} aria-hidden="true" /> : <Pin size={14} aria-hidden="true" />}
              </button>
              <button
                type="button"
                aria-label="Collapse search rail"
                onClick={collapse}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-muted)]"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-3 max-h-[70vh] overflow-y-auto">
            {tab === 'recent' ? (
              <ResumeSearchRecentSearches items={recentItems} onFill={onFillRecent} onExecute={onExecuteRecent} bare />
            ) : (
              <ResumeSearchSavedSearches
                items={savedItems}
                onFill={onFillSaved}
                canManage={canManageSaved}
                hasCriteria={hasCriteria}
                onSaveCurrent={onSaveCurrent}
                bare
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
