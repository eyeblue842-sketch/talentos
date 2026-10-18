"use client";

import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { ScheduleInterviewDialog } from './schedule-interview-dialog';

// Thin trigger used on the application detail page: a button that opens the
// shared ScheduleInterviewDialog. Kept with the same props so existing callers
// are unaffected.
export function ScheduleInterviewButton({ applicationId, candidateName, members = [], templates = [], plannedRounds = [] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] px-3 py-2 text-sm font-semibold">
        <CalendarClock size={15} aria-hidden="true" />
        Schedule interview
      </button>
      <ScheduleInterviewDialog
        open={open}
        onClose={() => setOpen(false)}
        applicationId={applicationId}
        candidateName={candidateName}
        members={members}
        templates={templates}
        plannedRounds={plannedRounds}
      />
    </>
  );
}

export default ScheduleInterviewButton;
