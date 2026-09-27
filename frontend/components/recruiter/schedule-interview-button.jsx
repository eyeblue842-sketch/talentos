"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';

const INTERVIEW_TYPES = ['SCREENING', 'TECHNICAL', 'MANAGERIAL', 'HR', 'BEHAVIORAL', 'CLIENT'];
// provider → { meetingMode, meetingProvider }
const PROVIDERS = {
  GOOGLE_MEET: { label: 'Google Meet', meetingMode: 'VIRTUAL', meetingProvider: 'GOOGLE_MEET', virtual: true },
  ZOOM: { label: 'Zoom', meetingMode: 'VIRTUAL', meetingProvider: 'ZOOM', virtual: true },
  IN_PERSON: { label: 'In-person', meetingMode: 'IN_PERSON', meetingProvider: null, virtual: false },
};

// The ATS "Schedule interview" popup (Zoho-style): pick provider (Google Meet /
// Zoom / In-person), time, panel and an assessment template, then create a
// scheduled round and move the candidate to Interview Scheduled.
export function ScheduleInterviewButton({ applicationId, candidateName, members = [], templates = [], plannedRounds = [] }) {
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    roundName: 'Interview round 1',
    interviewType: 'TECHNICAL',
    provider: 'GOOGLE_MEET',
    date: '',
    time: '',
    durationMinutes: 60,
    meetingLink: '',
    officeAddress: '',
    assessmentTemplateId: templates.find((t) => t.isDefault)?.id || templates[0]?.id || '',
    panel: [],
    notes: '',
  });

  function update(field, value) {
    setForm((c) => ({ ...c, [field]: value }));
  }
  function togglePanel(userId) {
    setForm((c) => ({ ...c, panel: c.panel.includes(userId) ? c.panel.filter((u) => u !== userId) : [...c.panel, userId] }));
  }

  const provider = PROVIDERS[form.provider];

  async function submit() {
    if (!form.date || !form.time) {
      push({ tone: 'error', title: 'Pick date & time', description: 'Set when the interview happens.' });
      return;
    }
    const start = new Date(`${form.date}T${form.time}`);
    if (Number.isNaN(start.getTime())) {
      push({ tone: 'error', title: 'Invalid date/time', description: 'Check the date and time.' });
      return;
    }
    const end = new Date(start.getTime() + (Number(form.durationMinutes) || 60) * 60000);
    setSaving(true);
    try {
      const response = await fetch(`/api/recruiter/interviews/quick-schedule/${applicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundName: form.roundName.trim() || 'Interview round 1',
          interviewType: form.interviewType,
          scheduledStartAt: start.toISOString(),
          scheduledEndAt: end.toISOString(),
          durationMinutes: Number(form.durationMinutes) || 60,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
          meetingMode: provider.meetingMode,
          meetingProvider: provider.meetingProvider || undefined,
          meetingLink: provider.virtual ? (form.meetingLink.trim() || undefined) : undefined,
          officeAddress: !provider.virtual ? (form.officeAddress.trim() || undefined) : undefined,
          assessmentTemplateId: form.assessmentTemplateId || undefined,
          panelUserIds: form.panel,
          notes: form.notes.trim() || undefined,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) {
        throw new Error(body?.message || 'Could not schedule the interview.');
      }
      push({ tone: 'success', title: 'Interview scheduled', description: `${candidateName || 'Candidate'} moved to Interview Scheduled. Panel notified.` });
      setOpen(false);
      router.refresh();
    } catch (error) {
      push({ tone: 'error', title: 'Could not schedule', description: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] px-3 py-2 text-sm font-semibold">
        <CalendarClock size={15} aria-hidden="true" />
        Schedule interview
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Schedule interview" description={candidateName ? `For ${candidateName}` : undefined}>
        <div className="space-y-4">
          {plannedRounds.length ? (
            <Select
              label="Planned round"
              value=""
              onChange={(e) => {
                const r = plannedRounds[Number(e.target.value)];
                if (r) { update('roundName', r.roundName); update('interviewType', r.interviewType || 'TECHNICAL'); if (r.assessmentTemplateId) update('assessmentTemplateId', r.assessmentTemplateId); }
              }}
            >
              <option value="">Pick from this opening's rounds…</option>
              {plannedRounds.map((r, i) => <option key={i} value={i}>{r.roundName}</option>)}
            </Select>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Round name" value={form.roundName} onChange={(e) => update('roundName', e.target.value)} />
            <Select label="Round type" value={form.interviewType} onChange={(e) => update('interviewType', e.target.value)}>
              {INTERVIEW_TYPES.map((t) => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}
            </Select>
          </div>
          <Select label="Meeting type" value={form.provider} onChange={(e) => update('provider', e.target.value)}>
            {Object.entries(PROVIDERS).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
          </Select>
          {provider.virtual ? (
            <Input label={`${provider.label} link`} value={form.meetingLink} onChange={(e) => update('meetingLink', e.target.value)} placeholder={form.provider === 'ZOOM' ? 'https://zoom.us/j/…' : 'https://meet.google.com/…'} helpText="Paste the meeting link (auto-generation needs the provider connected in Settings)." />
          ) : (
            <Textarea label="Venue / office address" value={form.officeAddress} onChange={(e) => update('officeAddress', e.target.value)} textareaClassName="min-h-20" />
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Input type="date" label="Date" value={form.date} onChange={(e) => update('date', e.target.value)} />
            <Input type="time" label="Time" value={form.time} onChange={(e) => update('time', e.target.value)} />
            <Input type="number" min="15" step="15" label="Duration (min)" value={form.durationMinutes} onChange={(e) => update('durationMinutes', e.target.value)} />
          </div>
          <Select label="Assessment form (shared with panel)" value={form.assessmentTemplateId} onChange={(e) => update('assessmentTemplateId', e.target.value)}>
            <option value="">No assessment form</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>)}
          </Select>
          <div>
            <p className="mb-2 text-sm font-semibold text-[var(--color-text)]">Panel / interviewers</p>
            <div className="max-h-40 space-y-1 overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border)] p-2">
              {members.length === 0 ? <p className="p-1 text-sm text-[var(--color-text-secondary)]">No members found.</p> : null}
              {members.map((m) => (
                <label key={m.userId || m.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm">
                  <input type="checkbox" checked={form.panel.includes(m.userId)} onChange={() => togglePanel(m.userId)} className="h-4 w-4 accent-[var(--color-primary)]" />
                  {m.user?.fullName || m.user?.email || m.userId}
                </label>
              ))}
            </div>
          </div>
          <Textarea label="Notes / instructions (optional)" value={form.notes} onChange={(e) => update('notes', e.target.value)} textareaClassName="min-h-20" />
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={submit} loading={saving}>Schedule</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
