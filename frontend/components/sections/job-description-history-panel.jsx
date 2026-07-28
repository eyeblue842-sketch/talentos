"use client";

import { History, FileClock, GitCompareArrows } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  buildDraftActivityLabel,
  buildDraftVersionLabel,
  formatJobDescriptionActor,
  formatJobDescriptionDate,
  getJobDraftStatusMeta,
} from '@/lib/job-description-intelligence';

function HistoryBadge({ status }) {
  const meta = getJobDraftStatusMeta(status);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function JobDescriptionHistoryPanel({
  drafts = [],
  selectedDraftId,
  onSelectDraft,
  onCompareDraft,
  loading = false,
  hidden = false,
}) {
  if (hidden) return null;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text)]">History</h3>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Review prior draft versions and open a read-only preview or side-by-side comparison.
          </p>
        </div>
        {loading ? <Badge tone="info">Refreshing history</Badge> : null}
      </div>

      {!drafts.length ? (
        <div className="mt-4">
          <EmptyState
            icon={History}
            title="No history yet"
            description="Saved draft versions will appear here after the first draft is created."
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {drafts.map((draft) => {
            const isSelected = draft.id === selectedDraftId;
            const actionLabel = buildDraftActivityLabel(draft);
            return (
              <div
                key={draft.id}
                className={`rounded-[var(--radius-lg)] border px-4 py-4 ${
                  isSelected
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                    : 'border-[var(--color-border)] bg-[var(--color-bg)]'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--color-text)]">{buildDraftVersionLabel(draft)}</span>
                      <HistoryBadge status={draft.status} />
                      <Badge tone="neutral">{actionLabel}</Badge>
                    </div>
                    <div className="grid gap-1 text-sm text-[var(--color-text-secondary)]">
                      <p>Created {formatJobDescriptionDate(draft.createdAt)}</p>
                      <p>Created by {formatJobDescriptionActor(draft.createdByUserId)}</p>
                      <p>Template {draft.templateId ? 'attached' : 'not used'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => onSelectDraft?.(draft.id)}>
                      <FileClock size={16} aria-hidden="true" />
                      Preview
                    </Button>
                    <Button type="button" variant="outline" onClick={() => onCompareDraft?.(draft.id)}>
                      <GitCompareArrows size={16} aria-hidden="true" />
                      Compare
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
