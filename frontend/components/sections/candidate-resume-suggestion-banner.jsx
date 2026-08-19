'use client';

import { useState } from 'react';
import { applyResumeParsedUpdatesAction } from '@/app/candidate/actions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const fieldLabels = {
  currentTitle: 'Current title',
  currentEmployer: 'Current employer',
  currentDesignation: 'Current designation',
  location: 'Location',
  headline: 'Resume headline',
  summary: 'Profile summary',
  phoneNumber: 'Phone number',
};

export function CandidateResumeSuggestionBanner({ suggestions, compact = false }) {
  const [expanded, setExpanded] = useState(false);

  if (!suggestions?.hasSuggestions || !suggestions.assetId) return null;

  return (
    <Card className="rounded-[28px] border-amber-200 bg-[linear-gradient(135deg,rgba(255,247,237,0.95),rgba(255,255,255,0.97))] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Resume updates</p>
          <h2 className="mt-2 font-[var(--font-display)] text-2xl font-semibold text-[var(--color-text)]">{suggestions.title}</h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{suggestions.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setExpanded((current) => !current)}>
            {expanded ? 'Hide updates' : 'Review updates'}
          </Button>
          {!compact ? (
            <form action={applyResumeParsedUpdatesAction}>
              <input type="hidden" name="assetId" value={suggestions.assetId} />
              <input type="hidden" name="dismiss" value="true" />
              {suggestions.items.map((item) => <input key={item.field} type="hidden" name="fields" value={item.field} />)}
              <Button type="submit" variant="outline">Dismiss</Button>
            </form>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 grid gap-3">
          {suggestions.items.map((item) => (
            <div key={item.field} className="grid gap-3 rounded-2xl border border-amber-100 bg-white/85 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold text-[var(--color-text)]">{fieldLabels[item.field] || item.field}</p>
                <div className="flex flex-wrap gap-2">
                  <form action={applyResumeParsedUpdatesAction}>
                    <input type="hidden" name="assetId" value={suggestions.assetId} />
                    <input type="hidden" name="fields" value={item.field} />
                    <Button type="submit" size="sm">Use resume value</Button>
                  </form>
                  <form action={applyResumeParsedUpdatesAction}>
                    <input type="hidden" name="assetId" value={suggestions.assetId} />
                    <input type="hidden" name="dismiss" value="true" />
                    <input type="hidden" name="fields" value={item.field} />
                    <Button type="submit" size="sm" variant="outline">Keep existing</Button>
                  </form>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Current</p>
                  <p className="mt-2 text-sm text-[var(--color-text)]">{item.currentValue || 'Empty'}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Resume</p>
                  <p className="mt-2 text-sm text-[var(--color-text)]">{item.resumeValue}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
