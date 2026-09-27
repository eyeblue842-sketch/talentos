"use client";

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { moveApplicationStageAction } from '@/app/recruiter/actions';

const stageTone = (stage) => {
  if (stage === 'SHORTLISTED' || stage === 'SELECTED') return 'success';
  if (stage === 'REJECTED') return 'neutral';
  if (stage === 'INTERVIEW_SCHEDULED') return 'info';
  return 'brand';
};
const stageLabel = (stage) => (stage || 'APPLIED').replaceAll('_', ' ');

// Naukri-style responses triage: for one posted job, review each applicant, run
// simple actions (Shortlist / Reject), and send a bulk email to the selected
// candidates. Sits alongside (not instead of) the full ATS pipeline.
export function JobResponsesTriage({ jobId, jobTitle, responses }) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [emailOpen, setEmailOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState({ subject: '', body: '' });

  // Only candidates with a real inbox can be emailed.
  const emailable = useMemo(
    () => responses.filter((r) => r.candidate?.email && r.candidate?.id),
    [responses],
  );
  const selectedList = useMemo(
    () => emailable.filter((r) => selected.has(r.candidate.id)),
    [emailable, selected],
  );
  const allSelected = emailable.length > 0 && selectedList.length === emailable.length;

  function toggle(candidateId) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
  }

  function toggleAll() {
    setSelected(() => (allSelected ? new Set() : new Set(emailable.map((r) => r.candidate.id))));
  }

  function moveStage(applicationId, stage) {
    setBusyId(applicationId);
    const formData = new FormData();
    formData.set('stage', stage);
    startTransition(async () => {
      try {
        await moveApplicationStageAction(applicationId, formData);
        push({ tone: 'success', title: stage === 'REJECTED' ? 'Rejected' : 'Shortlisted', description: `Candidate moved to ${stageLabel(stage)}.` });
        router.refresh();
      } catch (error) {
        push({ tone: 'error', title: 'Could not update', description: error.message });
      } finally {
        setBusyId('');
      }
    });
  }

  async function sendBulkEmail() {
    if (email.subject.trim().length < 3) {
      push({ tone: 'error', title: 'Subject too short', description: 'Add a subject (3+ characters).' });
      return;
    }
    if (email.body.trim().length < 10) {
      push({ tone: 'error', title: 'Message too short', description: 'Write a message (10+ characters).' });
      return;
    }
    setSending(true);
    try {
      const response = await fetch('/api/recruiter/resume-search/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'email',
          payload: {
            candidateIds: selectedList.map((r) => r.candidate.id),
            jobId: jobId || undefined,
            subject: email.subject.trim(),
            body: email.body.trim(),
          },
        }),
      });
      const bodyJson = await response.json().catch(() => ({}));
      if (!response.ok || bodyJson?.success === false) {
        throw new Error(bodyJson?.message || 'Could not send the emails.');
      }
      const items = bodyJson?.data?.items || [];
      const sent = items.filter((i) => i.success).length;
      const failed = items.length - sent;
      push({
        tone: failed ? 'warning' : 'success',
        title: 'Emails processed',
        description: `${sent} sent${failed ? `, ${failed} skipped (no email)` : ''}.`,
      });
      setEmailOpen(false);
      setEmail({ subject: '', body: '' });
      setSelected(new Set());
    } catch (error) {
      push({ tone: 'error', title: 'Could not send emails', description: error.message });
    } finally {
      setSending(false);
    }
  }

  if (!responses.length) {
    return <p className="text-sm text-[var(--color-text-secondary)]">No responses for this job yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white px-4 py-3">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!emailable.length} className="h-4 w-4 accent-[var(--color-primary)]" />
          Select all emailable ({emailable.length})
        </label>
        <Button type="button" onClick={() => setEmailOpen(true)} disabled={!selectedList.length}>
          <Mail size={16} aria-hidden="true" />
          Email selected ({selectedList.length})
        </Button>
      </div>

      {responses.map((response) => {
        const candidate = response.candidate || {};
        const canEmail = Boolean(candidate.email && candidate.id);
        const rowBusy = pending && busyId === response.id;
        return (
          <div key={response.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <input
                  type="checkbox"
                  checked={candidate.id ? selected.has(candidate.id) : false}
                  onChange={() => candidate.id && toggle(candidate.id)}
                  disabled={!canEmail}
                  title={canEmail ? 'Select for bulk email' : 'No email on file'}
                  className="mt-1.5 h-4 w-4 accent-[var(--color-primary)]"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-[var(--color-text)]">{candidate.fullName || 'Candidate'}</h3>
                    <Badge tone={stageTone(response.currentStage)}>{stageLabel(response.currentStage)}</Badge>
                  </div>
                  {candidate.headline || candidate.currentTitle ? (
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{candidate.headline || candidate.currentTitle}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {candidate.email || 'No email on file'}
                    {response.appliedAt ? ` · Applied ${new Date(response.appliedAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => moveStage(response.id, 'SHORTLISTED')}
                  disabled={rowBusy || response.currentStage === 'SHORTLISTED'}
                  className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] px-4 text-sm font-semibold text-[var(--color-primary)] disabled:opacity-50"
                >
                  <CheckCircle2 size={15} aria-hidden="true" />
                  Shortlist
                </button>
                <button
                  type="button"
                  onClick={() => moveStage(response.id, 'REJECTED')}
                  disabled={rowBusy || response.currentStage === 'REJECTED'}
                  className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-sm font-semibold text-[var(--color-text)] disabled:opacity-50"
                >
                  <XCircle size={15} aria-hidden="true" />
                  Reject
                </button>
                {response.submittedApplicationId ? (
                  <Link
                    href={`/recruiter/ats/${response.submittedApplicationId}`}
                    className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 text-sm font-semibold text-[var(--color-text)]"
                  >
                    View profile
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}

      <Dialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        title={`Email ${selectedList.length} candidate${selectedList.length === 1 ? '' : 's'}`}
        description={jobTitle ? `Regarding ${jobTitle}. Recipients see only their own message.` : 'Recipients see only their own message.'}
      >
        <div className="space-y-4">
          <Input label="Subject" value={email.subject} onChange={(e) => setEmail((c) => ({ ...c, subject: e.target.value }))} placeholder={jobTitle ? `Opportunity: ${jobTitle}` : 'Subject'} />
          <Textarea label="Message" value={email.body} onChange={(e) => setEmail((c) => ({ ...c, body: e.target.value }))} placeholder="Write your message to the selected candidates…" textareaClassName="min-h-40" />
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setEmailOpen(false)} disabled={sending}>Cancel</Button>
            <Button type="button" onClick={sendBulkEmail} loading={sending}>Send email</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
