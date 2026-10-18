'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Plus } from 'lucide-react';
import { ScheduleInterviewDialog } from './schedule-interview-dialog';

// Card shown in the "Interview Scheduled" column. Unlike the plain name-link
// cards in other stages, this one showcases multi-round interviews: a little
// R1·R2·R3 strip coloured by each round's outcome, plus a "Schedule next round"
// action for 2nd/3rd/4th rounds. The name still links to the full profile.
function roundTone(round) {
  const status = String(round?.status || '').toUpperCase();
  const decision = String(round?.decision || '').toUpperCase();
  if (status === 'CANCELLED' || status === 'CANCELED') return 'cancelled';
  if (status === 'COMPLETED' || status === 'DONE' || round?.completedAt) {
    if (['PASS', 'PASSED', 'SELECTED', 'PROCEED', 'RECOMMEND', 'RECOMMENDED', 'YES'].includes(decision)) return 'pass';
    if (['FAIL', 'FAILED', 'REJECT', 'REJECTED', 'NO', 'NOT_RECOMMENDED'].includes(decision)) return 'fail';
    if (['HOLD', 'MAYBE', 'ON_HOLD'].includes(decision)) return 'hold';
    return 'done';
  }
  return 'upcoming';
}

const TONE_CLASS = {
  pass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  fail: 'bg-rose-100 text-rose-700 border-rose-200',
  hold: 'bg-amber-100 text-amber-800 border-amber-200',
  done: 'bg-slate-100 text-slate-700 border-slate-200',
  cancelled: 'bg-slate-100 text-slate-400 border-slate-200 line-through',
  upcoming: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)] border-transparent',
};

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

export function InterviewPipelineCard({
  applicationId,
  candidateName,
  profileHref,
  rounds = [],
  members = [],
  templates = [],
  plannedRounds = [],
}) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const sorted = [...rounds].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const nextSeq = (sorted.reduce((max, r) => Math.max(max, r.sequence ?? 0), sorted.length)) + 1;
  const nextPlanned = plannedRounds[nextSeq - 1];

  const nameNode = profileHref ? (
    <Link href={profileHref} className="group flex items-center justify-between gap-2 font-medium text-[var(--color-text)] hover:text-[var(--brand)]">
      <span className="truncate">{candidateName}</span>
      <ChevronRight size={14} className="shrink-0 opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
    </Link>
  ) : (
    <span className="font-medium text-[var(--color-text)]">{candidateName}</span>
  );

  return (
    <div className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm shadow-sm transition hover:shadow-md">
      {nameNode}

      {sorted.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {sorted.map((round, index) => (
            <span
              key={round.id || index}
              title={`${round.roundName || `Round ${round.sequence ?? index + 1}`}${round.interviewType ? ` · ${String(round.interviewType).replaceAll('_', ' ')}` : ''}${round.status ? ` · ${String(round.status).toLowerCase()}` : ''}${fmtDate(round.scheduledStartAt) ? ` · ${fmtDate(round.scheduledStartAt)}` : ''}`}
              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${TONE_CLASS[roundTone(round)]}`}
            >
              R{round.sequence ?? index + 1}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">No rounds yet.</p>
      )}

      <button
        type="button"
        onClick={() => setScheduleOpen(true)}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand)] hover:underline"
      >
        <Plus size={13} aria-hidden="true" />
        {sorted.length ? `Schedule round ${nextSeq}` : 'Schedule interview'}
      </button>

      <ScheduleInterviewDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        applicationId={applicationId}
        candidateName={candidateName}
        members={members}
        templates={templates}
        plannedRounds={plannedRounds}
        defaultRoundName={nextPlanned?.roundName || `Interview round ${nextSeq}`}
        defaultInterviewType={nextPlanned?.interviewType}
      />
    </div>
  );
}

export default InterviewPipelineCard;
