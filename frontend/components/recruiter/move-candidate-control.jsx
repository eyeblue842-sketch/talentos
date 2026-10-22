'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { ScheduleInterviewDialog } from './schedule-interview-dialog';

const INTERVIEW_STAGE = 'INTERVIEW_SCHEDULED';

// A single control for the ATS board: pick a candidate, pick the stage to move
// them to, hit Move. Moving to "Interview Scheduled" opens the Schedule dialog
// instead (scheduling a round is what moves them there). Candidates are
// [{ applicationId, name, currentStage }]; stageOptions are [{ value, label }].
export function MoveCandidateControl({
  candidates = [],
  stageOptions = [],
  moveStageAction,
  members = [],
  templates = [],
  plannedRounds = [],
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [applicationId, setApplicationId] = useState('');
  const [stage, setStage] = useState('');
  const [message, setMessage] = useState(null);
  const [scheduleFor, setScheduleFor] = useState(null);

  const labelOf = (value) => stageOptions.find((option) => option.value === value)?.label || value;
  const selected = candidates.find((candidate) => candidate.applicationId === applicationId) || null;

  function onSelectCandidate(id) {
    setApplicationId(id);
    const candidate = candidates.find((item) => item.applicationId === id);
    setStage(candidate?.currentStage || '');
    setMessage(null);
  }

  function reset() {
    setApplicationId('');
    setStage('');
  }

  function move() {
    if (!applicationId || !stage) return;

    // Moving to Interview Scheduled → open the Schedule dialog; scheduling the
    // round is what actually moves the candidate to that stage server-side.
    if (stage === INTERVIEW_STAGE) {
      setScheduleFor({ applicationId, name: selected?.name || 'Candidate' });
      setMessage(null);
      return;
    }

    if (selected && stage === selected.currentStage) {
      setMessage({ tone: 'info', text: `${selected.name} is already in ${labelOf(stage)}.` });
      return;
    }
    const formData = new FormData();
    formData.set('stage', stage);
    const movedName = selected?.name || 'Candidate';
    const movedTo = labelOf(stage);
    setMessage(null);
    startTransition(async () => {
      try {
        await moveStageAction(applicationId, formData);
        router.refresh();
        setMessage({ tone: 'success', text: `${movedName} moved to ${movedTo}.` });
        reset();
      } catch (error) {
        setMessage({ tone: 'error', text: error?.message || 'Could not move the candidate.' });
      }
    });
  }

  const selectClass = 'w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--color-text)] disabled:opacity-60';

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Candidate</label>
          <select value={applicationId} onChange={(event) => onSelectCandidate(event.target.value)} className={selectClass} disabled={!candidates.length}>
            <option value="">{candidates.length ? 'Select a candidate…' : 'No candidates yet'}</option>
            {/* A withdrawn application can no longer be moved through the pipeline. */}
            {candidates.filter((candidate) => candidate.currentStage !== 'WITHDRAWN').map((candidate) => (
              <option key={candidate.applicationId} value={candidate.applicationId}>
                {candidate.name} — {labelOf(candidate.currentStage)}
              </option>
            ))}
          </select>
        </div>

        <ArrowRight size={18} className="mb-2 hidden shrink-0 text-[var(--color-text-secondary)] sm:block" aria-hidden="true" />

        <div className="min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Move to stage</label>
          <select value={stage} onChange={(event) => setStage(event.target.value)} className={selectClass} disabled={!applicationId}>
            <option value="">Select stage…</option>
            {stageOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={move}
          disabled={!applicationId || !stage || isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
          {stage === INTERVIEW_STAGE ? 'Schedule…' : (isPending ? 'Moving…' : 'Move')}
        </button>
      </div>

      {message ? (
        <p className={`mt-2 inline-flex items-center gap-1 text-xs ${
          message.tone === 'error' ? 'text-rose-600' : message.tone === 'success' ? 'text-emerald-600' : 'text-[var(--color-text-secondary)]'
        }`}>
          {message.tone === 'success' ? <CheckCircle2 size={14} /> : null}
          {message.text}
        </p>
      ) : null}

      <ScheduleInterviewDialog
        open={Boolean(scheduleFor)}
        onClose={() => setScheduleFor(null)}
        applicationId={scheduleFor?.applicationId}
        candidateName={scheduleFor?.name}
        members={members}
        templates={templates}
        plannedRounds={plannedRounds}
        onScheduled={() => { setScheduleFor(null); reset(); router.refresh(); }}
      />
    </div>
  );
}

export default MoveCandidateControl;
