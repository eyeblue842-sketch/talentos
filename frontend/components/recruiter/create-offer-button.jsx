"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { createOfferDraftAction, moveApplicationStageAction } from '@/app/recruiter/actions';

const WORK_MODES = ['ONSITE', 'REMOTE', 'HYBRID'];
const ANNEXURE_ROWS = ['Basic', 'HRA', 'Special Allowance', 'LTA', 'Fuel Allowance', 'Food Allowance', 'Employer PF', 'Gratuity', 'Medical Insurance', 'Performance Bonus'];

// Move-to-offer popup (Zoho "Generate Offer Letter" equivalent): fills the offer
// form, creates the offer draft (reusing the existing offer service + downloadable
// PDF), and moves the candidate to the OFFER stage.
export function CreateOfferButton({ applicationId, candidateName, templates = [] }) {
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState(templates.find((t) => t.isDefault)?.id || templates[0]?.id || '');
  const [form, setForm] = useState({
    currency: 'INR', annualCompensation: '', fixedCompensation: '', variableCompensation: '',
    joiningBonus: '', otherCompensation: '', proposedJoiningDate: '', workMode: 'ONSITE',
    workLocation: '', reportingManagerName: '', offerExpiryDays: 7,
    benefitsSummary: '', compensationNotes: '', termsAndConditions: '', internalNotes: '',
  });

  const [annexure, setAnnexure] = useState({});
  const [custom, setCustom] = useState({ designation: '', joiningLocation: '', reportingTo: '', workingDays: '', contractStartDate: '', contractEndDate: '', trainingEndDate: '', stipend: '', perHour: '' });
  const [extraFields, setExtraFields] = useState([]);
  const [generatedOfferId, setGeneratedOfferId] = useState(null);
  function update(field, value) {
    setForm((c) => ({ ...c, [field]: value }));
  }
  function updateAnnexure(label, value) {
    setAnnexure((c) => ({ ...c, [label]: value }));
  }
  function updateCustom(field, value) {
    setCustom((c) => ({ ...c, [field]: value }));
  }

  function applyTemplate(id) {
    setTemplateId(id);
    const defaults = templates.find((t) => t.id === id)?.defaults || {};
    setForm((c) => ({ ...c, ...Object.fromEntries(Object.entries(defaults).filter(([, v]) => v != null && v !== '')) }));
  }

  async function submit() {
    if (!form.annualCompensation) {
      push({ tone: 'error', title: 'CTC required', description: 'Enter the annual compensation.' });
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.set(k, v ?? ''));
      if (templateId) fd.set('offerTemplateId', templateId);
      const components = ANNEXURE_ROWS
        .filter((label) => annexure[label] !== undefined && annexure[label] !== '')
        .map((label) => ({ label, type: label === 'Basic' ? 'FIXED' : 'ALLOWANCE', amount: Number(annexure[label]) || 0, frequency: 'ANNUAL' }));
      if (components.length) fd.set('components', JSON.stringify(components));
      const customFields = Object.fromEntries(Object.entries(custom).filter(([, v]) => v !== '' && v != null));
      for (const { label, value } of extraFields) {
        if (label && label.trim()) customFields[label.trim()] = value ?? '';
      }
      if (Object.keys(customFields).length) fd.set('customFields', JSON.stringify(customFields));
      const created = await createOfferDraftAction(applicationId, fd);
      const stageFd = new FormData();
      stageFd.set('stage', 'OFFER');
      await moveApplicationStageAction(applicationId, stageFd);
      setGeneratedOfferId(created?.id || null);
      push({ tone: 'success', title: 'Offer letter generated', description: `${candidateName || 'Candidate'} moved to Offer.` });
      router.refresh();
    } catch (error) {
      push({ tone: 'error', title: 'Could not create offer', description: error.message || 'Try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => { setGeneratedOfferId(null); setOpen(true); }} className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-[var(--color-primary-soft)] px-3 py-2 text-sm font-semibold text-[var(--color-primary)]">
        <FileText size={15} aria-hidden="true" />
        Generate offer letter
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Generate Offer Letter" description={candidateName ? `For ${candidateName}` : undefined}>
        {generatedOfferId ? (
          <div className="space-y-4">
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
              <p className="font-semibold text-[var(--color-text)]">Offer letter generated ✓</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">The offer is saved as a record and the letter is ready to download. After sharing it, mark <span className="font-semibold">Offer accepted</span> or <span className="font-semibold">Offer declined</span> on the candidate&apos;s card.</p>
            </div>
            <a href={`/api/offers/${generatedOfferId}/document`} className="inline-flex items-center gap-2 rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Download offer letter</a>
            <div className="flex justify-end">
              <Button type="button" onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
        <div className="space-y-5">
          {templates.length ? (
            <Select label="Offer template" value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">No template</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>)}
            </Select>
          ) : null}

          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Employment Information</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Designation" value={custom.designation} onChange={(e) => updateCustom('designation', e.target.value)} placeholder="e.g. Senior Software Engineer" />
              <Select label="Work mode" value={form.workMode} onChange={(e) => update('workMode', e.target.value)}>
                {WORK_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
              <Input label="Joining location" value={custom.joiningLocation} onChange={(e) => updateCustom('joiningLocation', e.target.value)} />
              <Input label="Reporting to" value={custom.reportingTo} onChange={(e) => updateCustom('reportingTo', e.target.value)} />
              <Input type="datetime-local" label="Expected joining date" value={form.proposedJoiningDate} onChange={(e) => update('proposedJoiningDate', e.target.value)} />
              <Input label="Working days" value={custom.workingDays} onChange={(e) => updateCustom('workingDays', e.target.value)} placeholder="e.g. Monday to Friday" />
              <Input type="date" label="Contract start date" value={custom.contractStartDate} onChange={(e) => updateCustom('contractStartDate', e.target.value)} />
              <Input type="date" label="Contract end date" value={custom.contractEndDate} onChange={(e) => updateCustom('contractEndDate', e.target.value)} />
              <Input type="date" label="Training end date" value={custom.trainingEndDate} onChange={(e) => updateCustom('trainingEndDate', e.target.value)} />
              <Input type="number" min="0" label="Stipend (intern)" value={custom.stipend} onChange={(e) => updateCustom('stipend', e.target.value)} />
              <Input type="number" min="0" label="Per hour" value={custom.perHour} onChange={(e) => updateCustom('perHour', e.target.value)} />
              <Input type="number" min="1" max="90" label="Offer expiry (days)" value={form.offerExpiryDays} onChange={(e) => update('offerExpiryDays', e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Annexure — Annual Salary Stack</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Currency" value={form.currency} onChange={(e) => update('currency', e.target.value)} />
              <Input type="number" min="0" label="CTC / annum" value={form.annualCompensation} onChange={(e) => update('annualCompensation', e.target.value)} />
              <Input type="number" min="0" label="Fixed / annum" value={form.fixedCompensation} onChange={(e) => update('fixedCompensation', e.target.value)} />
              <Input type="number" min="0" label="Variable / annum" value={form.variableCompensation} onChange={(e) => update('variableCompensation', e.target.value)} />
              <Input type="number" min="0" label="Joining bonus" value={form.joiningBonus} onChange={(e) => update('joiningBonus', e.target.value)} />
              <Input type="number" min="0" label="Other compensation" value={form.otherCompensation} onChange={(e) => update('otherCompensation', e.target.value)} />
            </div>
            {form.annualCompensation ? <p className="text-xs font-semibold text-[var(--color-text)]">CTC ≈ {form.currency} {Math.round(Number(form.annualCompensation) / 12).toLocaleString('en-IN')} / month</p> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {ANNEXURE_ROWS.map((label) => (
                <div key={label}>
                  <Input type="number" min="0" label={`${label} / annum`} value={annexure[label] ?? ''} onChange={(e) => updateAnnexure(label, e.target.value)} />
                  {annexure[label] ? <p className="mt-1 text-xs text-[var(--color-text-secondary)]">≈ {form.currency} {Math.round(Number(annexure[label]) / 12).toLocaleString('en-IN')} / month</p> : null}
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">Each row auto-derives a monthly value. In the letter, use {'{basic}'} / «Offers.Basic/annum» for annual and «Offers.Basic/month» for monthly.</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Additional information</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setExtraFields((f) => [...f, { label: '', value: '' }])}>Add field</Button>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">Company-specific fields for this offer letter. Each becomes a merge token — use «Offers.&lt;Label&gt;» (or the lowercase label) in your template.</p>
            {extraFields.map((row, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <Input className="min-w-[150px] flex-1" label={index === 0 ? 'Field name' : undefined} value={row.label} onChange={(e) => setExtraFields((f) => f.map((r, i) => (i === index ? { ...r, label: e.target.value } : r)))} placeholder="e.g. Probation Period" />
                <Input className="min-w-[150px] flex-1" label={index === 0 ? 'Value' : undefined} value={row.value} onChange={(e) => setExtraFields((f) => f.map((r, i) => (i === index ? { ...r, value: e.target.value } : r)))} placeholder="e.g. 6 months" />
                <button type="button" onClick={() => setExtraFields((f) => f.filter((_, i) => i !== index))} className="pb-2 text-sm font-semibold text-[var(--color-danger)]">Remove</button>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Other</p>
            <Textarea label="Benefits summary" value={form.benefitsSummary} onChange={(e) => update('benefitsSummary', e.target.value)} textareaClassName="min-h-16" />
            <Textarea label="Compensation notes" value={form.compensationNotes} onChange={(e) => update('compensationNotes', e.target.value)} textareaClassName="min-h-16" />
            <Textarea label="Terms and conditions" value={form.termsAndConditions} onChange={(e) => update('termsAndConditions', e.target.value)} textareaClassName="min-h-20" />
            <Textarea label="Internal notes" value={form.internalNotes} onChange={(e) => update('internalNotes', e.target.value)} textareaClassName="min-h-16" />
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--color-border)] pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={submit} loading={saving}>Save and Next</Button>
          </div>
        </div>
        )}
      </Dialog>
    </>
  );
}
