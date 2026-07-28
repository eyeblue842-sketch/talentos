"use client";

import { CheckCircle2, FileClock, PencilLine, Sparkles, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatJobDescriptionActor, formatJobDescriptionDate } from '@/lib/job-description-intelligence';

function getEventIcon(type) {
  if (type === 'GENERATED' || type === 'REGENERATED') return Sparkles;
  if (type === 'APPLIED') return CheckCircle2;
  if (type === 'FAILED') return TriangleAlert;
  return PencilLine;
}

function getEventTone(type) {
  if (type === 'GENERATED' || type === 'REGENERATED') return 'info';
  if (type === 'APPLIED') return 'success';
  if (type === 'FAILED') return 'danger';
  return 'neutral';
}

export function JobDescriptionVersionTimeline({ events = [], hidden = false }) {
  if (hidden) return null;

  return (
    <Card>
      <div>
        <h3 className="text-lg font-semibold text-[var(--color-text)]">Timeline</h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Chronological activity for AI generation, recruiter edits, and applied draft versions.
        </p>
      </div>

      {!events.length ? (
        <div className="mt-4">
          <EmptyState
            icon={FileClock}
            title="No timeline activity yet"
            description="Generation and draft actions will appear here after the first AI run or saved draft."
          />
        </div>
      ) : (
        <ol className="mt-4 grid gap-4">
          {events.map((event) => {
            const Icon = getEventIcon(event.type);
            return (
              <li key={event.id} className="flex gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
                <div className="mt-1 rounded-full bg-[var(--color-bg-muted)] p-2 text-[var(--color-text-secondary)]">
                  <Icon size={16} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--color-text)]">{event.label}</p>
                    <Badge tone={getEventTone(event.type)}>{event.kind}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{event.description}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--color-text-muted)]">
                    <span>{formatJobDescriptionDate(event.timestamp)}</span>
                    <span>{formatJobDescriptionActor(event.actorUserId)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
