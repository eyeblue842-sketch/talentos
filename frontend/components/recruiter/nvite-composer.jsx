"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/toast';
import { JobLocationSelector, toCanonicalLocations } from '@/components/sections/job-post/job-location-selector';
import { SkillsSelector } from '@/components/sections/job-post/skills-selector';
import { DEPARTMENT_OPTIONS, rolesForDepartment } from '@/lib/department-role-taxonomy';

const WORKPLACE_TYPES = ['ONSITE', 'HYBRID', 'REMOTE'];
const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY'];
const QUESTION_TYPES = ['SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'SINGLE_SELECT', 'MULTI_SELECT', 'BOOLEAN'];

const emptyForm = {
  mode: 'new',
  jobId: '',
  title: '',
  workplaceType: 'ONSITE',
  employmentType: 'FULL_TIME',
  department: '',
  role: '',
  locations: [],
  skills: [],
  experienceMin: '',
  experienceMax: '',
  salaryMin: '',
  salaryMax: '',
  hideSalary: false,
  numberOfOpenings: 1,
  description: '',
  isWalkIn: false,
  walkInStartDate: '',
  walkInEndDate: '',
  walkInTiming: '',
  walkInContactName: '',
  walkInContactPhone: '',
  walkInVenueAddress: '',
  walkInGoogleMapsUrl: '',
  questions: [],
  subject: '',
  message: '',
  recipients: '',
};

// Naukri NVite-style composer: a 4-step wizard that broadcasts a structured role
// to the selected candidates. On send it creates (or targets) an opening,
// associates the candidates to it, and emails them the role + message. Their
// responses then appear under that opening in ATS Pipeline / Job Responses.
export function NviteComposer({ open, onClose, candidates = [], onSent }) {
  const router = useRouter();
  const { push } = useToast();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [openings, setOpenings] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setForm((current) => ({ ...emptyForm, subject: current.subject, message: current.message }));
    (async () => {
      try {
        const response = await fetch('/api/recruiter/ats/openings');
        const body = await response.json().catch(() => ({}));
        if (response.ok) setOpenings(body?.data || []);
      } catch {
        // Non-fatal: the "existing opening" picker just stays empty.
      }
    })();
  }, [open]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateQuestion(index, field, value) {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((q, i) => (i === index ? { ...q, [field]: value } : q)),
    }));
  }

  const selectedOpening = openings.find((opening) => opening.id === form.jobId) || null;
  const totalStepsForNew = 4;
  // When targeting an existing opening we skip the role-details step.
  const isRoleStep = step === 2 && form.mode === 'new';

  function next() {
    if (step === 1) {
      if (form.mode === 'existing' && !form.jobId) {
        push({ tone: 'error', title: 'Pick an opening', description: 'Choose an existing opening to invite candidates to.' });
        return;
      }
      setStep(form.mode === 'new' ? 2 : 3);
      return;
    }
    if (isRoleStep) {
      if (form.title.trim().length < 2) {
        push({ tone: 'error', title: 'Title required', description: 'Give the new opening a title.' });
        return;
      }
      setStep(3);
      return;
    }
    if (step === 3) {
      if (form.subject.trim().length < 3) {
        push({ tone: 'error', title: 'Subject too short', description: 'Add a subject (3+ characters).' });
        return;
      }
      if (form.message.trim().length < 10) {
        push({ tone: 'error', title: 'Message too short', description: 'Write a message (10+ characters).' });
        return;
      }
      setStep(4);
    }
  }

  function back() {
    if (step === 4) return setStep(3);
    if (step === 3) return setStep(form.mode === 'new' ? 2 : 1);
    if (step === 2) return setStep(1);
    return undefined;
  }

  async function send() {
    setSending(true);
    try {
      const recipients = form.recipients
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);
      const payload = {
        candidateIds: candidates.map((candidate) => candidate.id),
        mode: form.mode,
        subject: form.subject.trim(),
        message: form.message.trim(),
        responseRecipients: recipients,
      };
      if (form.mode === 'existing') {
        payload.jobId = form.jobId;
      } else {
        Object.assign(payload, {
          title: form.title.trim(),
          workplaceType: form.workplaceType,
          employmentType: form.employmentType,
          department: [form.department, form.role].filter(Boolean).join(' - ') || undefined,
          location: form.locations.join(', ') || undefined,
          locations: toCanonicalLocations(form.locations),
          skillsRequired: form.skills,
          experienceMin: form.experienceMin === '' ? undefined : Number(form.experienceMin),
          experienceMax: form.experienceMax === '' ? undefined : Number(form.experienceMax),
          salaryMin: form.salaryMin === '' ? undefined : Number(form.salaryMin),
          salaryMax: form.salaryMax === '' ? undefined : Number(form.salaryMax),
          hideSalary: form.hideSalary,
          numberOfOpenings: Number(form.numberOfOpenings) || 1,
          description: form.description.trim() || undefined,
          isWalkIn: form.isWalkIn,
          ...(form.isWalkIn ? {
            walkInStartDate: form.walkInStartDate || undefined,
            walkInEndDate: form.walkInEndDate || undefined,
            walkInTiming: form.walkInTiming.trim() || undefined,
            walkInContactName: form.walkInContactName.trim() || undefined,
            walkInContactPhone: form.walkInContactPhone.trim() || undefined,
            walkInVenueAddress: form.walkInVenueAddress.trim() || undefined,
            walkInGoogleMapsUrl: form.walkInGoogleMapsUrl.trim() || undefined,
          } : {}),
          screeningQuestions: form.questions
            .filter((q) => q.questionText.trim().length >= 3)
            .map((q) => ({
              questionText: q.questionText.trim(),
              questionType: q.questionType,
              required: q.required,
              ...(['SINGLE_SELECT', 'MULTI_SELECT'].includes(q.questionType)
                ? { options: q.options.split(',').map((o) => o.trim()).filter(Boolean) }
                : {}),
            })),
        });
      }
      const response = await fetch('/api/recruiter/ats/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) {
        throw new Error(body?.message || 'Could not send the invite.');
      }
      const data = body?.data || {};
      push({
        tone: 'success',
        title: 'Invite sent',
        description: `${data.invite?.sentCount ?? 0} emailed${data.invite?.skippedCount ? `, ${data.invite.skippedCount} skipped` : ''}. Responses appear under "${data.job?.title || 'the opening'}".`,
      });
      if (data.job?.id) {
        router.push(`/recruiter/job-responses?jobId=${data.job.id}`);
      }
      onSent?.();
    } catch (error) {
      push({ tone: 'error', title: 'Could not send invite', description: error.message });
    } finally {
      setSending(false);
    }
  }

  const stepLabel = form.mode === 'new'
    ? `Step ${step} of ${totalStepsForNew}`
    : `Step ${step === 3 ? 2 : step === 4 ? 3 : 1} of 3`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite candidates to a job"
      description={`Reaching out to ${candidates.length} candidate${candidates.length === 1 ? '' : 's'} • ${stepLabel}`}
    >
      <div className="space-y-4">
        {step === 1 ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[var(--color-text)]">How would you like to proceed?</p>
            <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3">
              <input type="radio" name="nvite-mode" checked={form.mode === 'new'} onChange={() => update('mode', 'new')} className="mt-1 accent-[var(--color-primary)]" />
              <span>
                <span className="block font-semibold text-[var(--color-text)]">Create a new opening</span>
                <span className="block text-sm text-[var(--color-text-secondary)]">Responses appear as a new opening in ATS Pipeline & Job Responses.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3">
              <input type="radio" name="nvite-mode" checked={form.mode === 'existing'} onChange={() => update('mode', 'existing')} className="mt-1 accent-[var(--color-primary)]" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[var(--color-text)]">Use an existing opening</span>
                <span className="block text-sm text-[var(--color-text-secondary)]">Responses are clubbed with an opening you already have.</span>
              </span>
            </label>
            {form.mode === 'existing' ? (
              <Select label="Opening" value={form.jobId} onChange={(e) => update('jobId', e.target.value)}>
                <option value="">Select an opening…</option>
                {openings.map((opening) => (
                  <option key={opening.id} value={opening.id}>{opening.title}{opening.atsOnly ? ' (ATS only)' : ''}</option>
                ))}
              </Select>
            ) : null}
          </div>
        ) : null}

        {isRoleStep ? (
          <div className="space-y-4">
            <p className="rounded-[var(--radius-md)] bg-[var(--color-bg-muted)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">This posts a public opening so candidates get full details and an Apply button. Responses come back under this opening in Job Responses.</p>
            <Input label="Designation / title" value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Senior Java Developer" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Work mode" value={form.workplaceType} onChange={(e) => update('workplaceType', e.target.value)}>
                {WORKPLACE_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
              </Select>
              <Select label="Employment type" value={form.employmentType} onChange={(e) => update('employmentType', e.target.value)}>
                {EMPLOYMENT_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Department" value={form.department} onChange={(e) => { update('department', e.target.value); update('role', ''); }}>
                <option value="">Select department…</option>
                {DEPARTMENT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </Select>
              <Select label="Role" value={form.role} onChange={(e) => update('role', e.target.value)} disabled={!form.department}>
                <option value="">{form.department ? 'Select role…' : 'Pick a department first'}</option>
                {rolesForDepartment(form.department).map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </Select>
            </div>
            <SkillsSelector label="Key skills" value={form.skills} onChange={(value) => update('skills', value)} />
            <JobLocationSelector values={form.locations} onChange={(values) => update('locations', values)} />
            <div className="grid gap-4 sm:grid-cols-4">
              <Input type="number" min="0" label="Exp min" value={form.experienceMin} onChange={(e) => update('experienceMin', e.target.value)} />
              <Input type="number" min="0" label="Exp max" value={form.experienceMax} onChange={(e) => update('experienceMax', e.target.value)} />
              <Input type="number" min="0" label="Salary min" value={form.salaryMin} onChange={(e) => update('salaryMin', e.target.value)} />
              <Input type="number" min="0" label="Salary max" value={form.salaryMax} onChange={(e) => update('salaryMax', e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input type="number" min="1" label="Number of openings" value={form.numberOfOpenings} onChange={(e) => update('numberOfOpenings', e.target.value)} />
              <Checkbox label="Hide salary from candidates" checked={form.hideSalary} onChange={(e) => update('hideSalary', e.target.checked)} />
            </div>
            <Textarea
              label="Job description"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Role & responsibilities, preferred candidate profile, perks & benefits…"
              textareaClassName="min-h-32"
            />

            {/* Walk-in details */}
            <Checkbox label="Include walk-in details" checked={form.isWalkIn} onChange={(e) => update('isWalkIn', e.target.checked)} />
            {form.isWalkIn ? (
              <div className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input type="date" label="Walk-in start date" value={form.walkInStartDate} onChange={(e) => update('walkInStartDate', e.target.value)} />
                  <Input type="date" label="Walk-in end date" value={form.walkInEndDate} onChange={(e) => update('walkInEndDate', e.target.value)} />
                </div>
                <Input label="Walk-in timings" value={form.walkInTiming} onChange={(e) => update('walkInTiming', e.target.value)} placeholder="e.g. 9.30 AM - 5.30 PM" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Contact person name" value={form.walkInContactName} onChange={(e) => update('walkInContactName', e.target.value)} />
                  <Input label="Contact number" value={form.walkInContactPhone} onChange={(e) => update('walkInContactPhone', e.target.value)} />
                </div>
                <Textarea label="Venue" value={form.walkInVenueAddress} onChange={(e) => update('walkInVenueAddress', e.target.value)} placeholder="Type the venue address…" textareaClassName="min-h-20" />
                <Input label="Google Map URL of the venue" value={form.walkInGoogleMapsUrl} onChange={(e) => update('walkInGoogleMapsUrl', e.target.value)} placeholder="https://maps.google.com/…" />
              </div>
            ) : null}

            {/* Screening questions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--color-text)]">Screening questions (optional)</span>
                <Button type="button" variant="outline" size="sm" onClick={() => update('questions', [...form.questions, { questionText: '', questionType: 'SHORT_TEXT', required: false, options: '' }])}>Add question</Button>
              </div>
              {form.questions.map((q, index) => (
                <div key={index} className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3">
                  <Input label={`Question ${index + 1}`} value={q.questionText} onChange={(e) => updateQuestion(index, 'questionText', e.target.value)} placeholder="e.g. How many years with Java?" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select label="Answer type" value={q.questionType} onChange={(e) => updateQuestion(index, 'questionType', e.target.value)}>
                      {QUESTION_TYPES.map((t) => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}
                    </Select>
                    <label className="flex items-end gap-2 pb-2 text-sm text-[var(--color-text)]">
                      <input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(index, 'required', e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
                      Required
                    </label>
                  </div>
                  {['SINGLE_SELECT', 'MULTI_SELECT'].includes(q.questionType) ? (
                    <Input label="Options (comma-separated, min 2)" value={q.options} onChange={(e) => updateQuestion(index, 'options', e.target.value)} placeholder="Immediate, 15 days, 30 days" />
                  ) : null}
                  <button type="button" onClick={() => update('questions', form.questions.filter((_, i) => i !== index))} className="text-sm font-semibold text-[var(--color-danger)]">Remove</button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            {selectedOpening ? (
              <p className="rounded-[var(--radius-md)] bg-[var(--color-bg-muted)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">Inviting to <span className="font-semibold text-[var(--color-text)]">{selectedOpening.title}</span></p>
            ) : null}
            <Input label="Email subject" value={form.subject} onChange={(e) => update('subject', e.target.value)} placeholder={form.title ? `Opportunity: ${form.title}` : 'Opportunity at our company'} />
            <Textarea label="Message to candidates" value={form.message} onChange={(e) => update('message', e.target.value)} placeholder="Write a short note inviting them to this role…" textareaClassName="min-h-32" />
            <Input label="Response recipients (optional)" value={form.recipients} onChange={(e) => update('recipients', e.target.value)} placeholder="Comma-separated emails, max 5" helpText="These teammates get notified about responses to this opening." />
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[var(--color-text)]">Preview</p>
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
              <p className="text-sm text-[var(--color-text-secondary)]">Subject</p>
              <p className="font-semibold text-[var(--color-text)]">{form.subject || '—'}</p>
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Message</p>
              <p className="whitespace-pre-wrap text-[var(--color-text)]">{form.message || '—'}</p>
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Role</p>
              <p className="text-[var(--color-text)]">{form.mode === 'new' ? (form.title || '—') : (selectedOpening?.title || '—')}</p>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">Reaching out to <span className="font-semibold text-[var(--color-text)]">{candidates.length}</span> candidate{candidates.length === 1 ? '' : 's'}. They will be added to this opening and emailed.</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
          <Button type="button" variant="outline" onClick={step === 1 ? onClose : back} disabled={sending}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          {step === 4 ? (
            <Button type="button" onClick={send} loading={sending} disabled={!candidates.length}>Send invite</Button>
          ) : (
            <Button type="button" onClick={next}>Next</Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
