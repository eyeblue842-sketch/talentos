"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY'];

// Creates an ATS-only opening (an internal, unposted requirement) so recruiters can
// source candidates from the resume databank into a pipeline without publishing a job.
export function AddAtsOpeningButton() {
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', location: '', department: '', employmentType: 'FULL_TIME', numberOfOpenings: 1, experienceMin: '', experienceMax: '', salaryMin: '', salaryMax: '', hiringManagerName: '', hiringManagerEmail: '' });
  const [rounds, setRounds] = useState([]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit() {
    if (form.title.trim().length < 2) {
      push({ tone: 'error', title: 'Title required', description: 'Give the opening a title.' });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/recruiter/ats/openings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          location: form.location.trim() || undefined,
          department: form.department.trim() || undefined,
          employmentType: form.employmentType,
          numberOfOpenings: Number(form.numberOfOpenings) || 1,
          experienceMin: form.experienceMin === '' ? undefined : Number(form.experienceMin),
          experienceMax: form.experienceMax === '' ? undefined : Number(form.experienceMax),
          salaryMin: form.salaryMin === '' ? undefined : Number(form.salaryMin),
          salaryMax: form.salaryMax === '' ? undefined : Number(form.salaryMax),
          hiringManagerName: form.hiringManagerName.trim() || undefined,
          hiringManagerEmail: form.hiringManagerEmail.trim() || undefined,
          interviewRounds: rounds.filter((r) => r.roundName.trim()).map((r) => ({ roundName: r.roundName.trim(), interviewType: r.interviewType })),
        }),
      });
      const bodyJson = await response.json().catch(() => ({}));
      if (!response.ok || bodyJson?.success === false) {
        throw new Error(bodyJson?.message || 'Could not create the opening.');
      }
      push({ tone: 'success', title: 'Opening created', description: `${form.title.trim()} is now an open position in your ATS.` });
      setOpen(false);
      setForm({ title: '', location: '', department: '', employmentType: 'FULL_TIME', numberOfOpenings: 1, experienceMin: '', experienceMax: '', salaryMin: '', salaryMax: '', hiringManagerName: '', hiringManagerEmail: '' });
      setRounds([]);
      router.refresh();
    } catch (error) {
      push({ tone: 'error', title: 'Could not create opening', description: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus size={16} aria-hidden="true" />
        Add job opening
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add job opening"
        description="Creates an ATS-only opening (not posted publicly). Add candidates to it from resume search."
      >
        <div className="space-y-4">
          <Input label="Opening title" value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Senior Java Developer" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Location" value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="e.g. Bengaluru" />
            <Input label="Department" value={form.department} onChange={(e) => update('department', e.target.value)} placeholder="e.g. Engineering" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Employment type" value={form.employmentType} onChange={(e) => update('employmentType', e.target.value)}>
              {EMPLOYMENT_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
            </Select>
            <Input type="number" min="1" label="Openings" value={form.numberOfOpenings} onChange={(e) => update('numberOfOpenings', e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" min="0" label="Exp min" value={form.experienceMin} onChange={(e) => update('experienceMin', e.target.value)} />
              <Input type="number" min="0" label="Exp max" value={form.experienceMax} onChange={(e) => update('experienceMax', e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input type="number" min="0" label="Minimum salary (annual)" value={form.salaryMin} onChange={(e) => update('salaryMin', e.target.value)} placeholder="e.g. 600000" />
            <Input type="number" min="0" label="Maximum salary (annual)" value={form.salaryMax} onChange={(e) => update('salaryMax', e.target.value)} placeholder="e.g. 900000" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Hiring manager name" value={form.hiringManagerName} onChange={(e) => update('hiringManagerName', e.target.value)} placeholder="e.g. Priya Sharma" />
            <Input type="email" label="Hiring manager email" value={form.hiringManagerEmail} onChange={(e) => update('hiringManagerEmail', e.target.value)} placeholder="e.g. priya@company.com" />
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">Hiring manager details are used later for interview scheduling.</p>

          <div className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--color-text)]">Interview rounds (optional)</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setRounds((r) => [...r, { roundName: `Round ${r.length + 1}`, interviewType: 'TECHNICAL' }])}>
                <Plus size={14} aria-hidden="true" /> Add round
              </Button>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">Define the default rounds for this opening (e.g. Screen → Technical → HR). They pre-fill when scheduling per candidate.</p>
            {rounds.map((round, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <Input className="min-w-[160px] flex-1" value={round.roundName} onChange={(e) => setRounds((rs) => rs.map((r, i) => (i === index ? { ...r, roundName: e.target.value } : r)))} placeholder={`Round ${index + 1} name`} />
                <Select value={round.interviewType} onChange={(e) => setRounds((rs) => rs.map((r, i) => (i === index ? { ...r, interviewType: e.target.value } : r)))}>
                  {['SCREENING', 'TECHNICAL', 'MANAGERIAL', 'HR', 'BEHAVIORAL', 'CLIENT'].map((t) => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}
                </Select>
                <button type="button" onClick={() => setRounds((rs) => rs.filter((_, i) => i !== index))} className="pb-2 text-sm font-semibold text-[var(--color-danger)]">Remove</button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={submit} loading={saving}>Create opening</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
