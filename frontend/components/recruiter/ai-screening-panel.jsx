'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Loader2, RefreshCw, ChevronDown } from 'lucide-react';
import { placeScreeningCallAction } from '@/app/recruiter/actions';

const STATUS_STYLES = {
  PENDING: 'bg-slate-100 text-slate-700',
  DRY_RUN: 'bg-slate-100 text-slate-600',
  QUEUED: 'bg-amber-100 text-amber-800',
  RINGING: 'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  NO_ANSWER: 'bg-orange-100 text-orange-800',
  BUSY: 'bg-orange-100 text-orange-800',
  FAILED: 'bg-rose-100 text-rose-700',
  CANCELLED: 'bg-slate-200 text-slate-600',
};

const OUTCOME_LABELS = {
  INTERESTED: 'Interested',
  NOT_INTERESTED: 'Not interested',
  CALLBACK_REQUESTED: 'Callback requested',
  DO_NOT_CONTACT: 'Do not contact',
  UNREACHABLE: 'Unreachable',
  INCOMPLETE: 'Incomplete',
  PENDING: null,
};

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {String(status || '').replace(/_/g, ' ').toLowerCase()}
    </span>
  );
}

function yesNo(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '—';
}

function ResultRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

function CallCard({ call }) {
  const r = call.results || {};
  const outcome = OUTCOME_LABELS[call.outcome];
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={call.status} />
          {call.dryRun ? (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
              simulated
            </span>
          ) : null}
          <span className="text-xs text-slate-400">via {call.provider}</span>
        </div>
        <span className="text-xs text-slate-400">
          {call.requestedAt ? new Date(call.requestedAt).toLocaleString() : ''}
        </span>
      </div>

      {outcome ? (
        <p className="mt-2 text-sm font-semibold text-slate-800">{outcome}</p>
      ) : null}
      {r.aiSummary ? <p className="mt-1 text-sm text-slate-600">{r.aiSummary}</p> : null}

      <div className="mt-2 divide-y divide-slate-100">
        <ResultRow label="Current CTC" value={r.currentCtc} />
        <ResultRow label="Expected CTC" value={r.expectedCtc} />
        <ResultRow label="Notice period" value={r.noticePeriod} />
        {(r.noticeNegotiable !== null && r.noticeNegotiable !== undefined)
          ? <ResultRow label="Notice negotiable" value={yesNo(r.noticeNegotiable)} /> : null}
        {(r.buyoutAvailable !== null && r.buyoutAvailable !== undefined)
          ? <ResultRow label="Buyout available" value={yesNo(r.buyoutAvailable)} /> : null}
        <ResultRow label="Can join" value={r.earliestJoinDate} />
      </div>

      {call.errorMessage ? (
        <p className="mt-2 text-xs text-rose-600">{call.errorMessage}</p>
      ) : null}
      {call.recordingUrl ? (
        <a href={call.recordingUrl} target="_blank" rel="noreferrer"
           className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline">
          Listen to recording
        </a>
      ) : null}
    </div>
  );
}

export function AiScreeningPanel({ applicationId, calls = [] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const [clientCompanyBrief, setClientCompanyBrief] = useState('');
  const [screeningQuestions, setScreeningQuestions] = useState('');

  function trigger() {
    setError(null);
    const formData = new FormData();
    if (clientCompanyBrief.trim()) formData.set('clientCompanyBrief', clientCompanyBrief.trim());
    if (screeningQuestions.trim()) formData.set('screeningQuestions', screeningQuestions.trim());
    startTransition(async () => {
      try {
        await placeScreeningCallAction(applicationId, formData);
        router.refresh();
      } catch (err) {
        setError(err?.message || 'Could not start the screening call.');
      }
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Phone className="h-4 w-4 text-blue-600" /> AI phone screening
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Aria calls the candidate to confirm interest and capture CTC, notice period and more.
          </p>
        </div>
        <button
          type="button"
          onClick={trigger}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
          {isPending ? 'Starting…' : 'Start screening call'}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowOptions((v) => !v)}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${showOptions ? 'rotate-180' : ''}`} />
        Customize this call (optional)
      </button>
      {showOptions ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={clientCompanyBrief}
            onChange={(e) => setClientCompanyBrief(e.target.value)}
            rows={2}
            placeholder="Client company brief — e.g. an IT services company based in Bangalore with offices in Chennai and Trichy"
            className="w-full rounded-lg border border-slate-200 p-2 text-sm"
          />
          <textarea
            value={screeningQuestions}
            onChange={(e) => setScreeningQuestions(e.target.value)}
            rows={3}
            placeholder="Technical questions, one per line (leave blank to use the job's skills)"
            className="w-full rounded-lg border border-slate-200 p-2 text-sm"
          />
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {calls.length ? `${calls.length} call${calls.length > 1 ? 's' : ''}` : 'No calls yet'}
        </span>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      <div className="mt-2 space-y-2">
        {calls.map((call) => <CallCard key={call.id} call={call} />)}
      </div>
    </section>
  );
}

export default AiScreeningPanel;
