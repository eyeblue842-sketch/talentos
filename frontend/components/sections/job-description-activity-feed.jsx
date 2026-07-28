"use client";

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ScrollText } from 'lucide-react';
import { formatJobDescriptionActor, formatJobDescriptionDate } from '@/lib/job-description-intelligence';

export function JobDescriptionActivityFeed({ events = [], hidden = false }) {
  if (hidden) return null;

  return (
    <Card>
      <div>
        <h3 className="text-lg font-semibold text-[var(--color-text)]">Activity feed</h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Recent AI and recruiter actions for this job description workspace.
        </p>
      </div>

      {!events.length ? (
        <div className="mt-4">
          <EmptyState
            icon={ScrollText}
            title="No activity yet"
            description="The activity feed will populate after AI generations or draft actions occur."
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {events.map((event) => (
            <div
              key={`feed-${event.id}`}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[var(--color-text)]">{event.label}</p>
                <Badge tone="neutral">{event.kind}</Badge>
              </div>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{event.description}</p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--color-text-muted)]">
                <span>{formatJobDescriptionDate(event.timestamp)}</span>
                <span>{formatJobDescriptionActor(event.actorUserId)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
