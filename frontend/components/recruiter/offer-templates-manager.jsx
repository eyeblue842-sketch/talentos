"use client";

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';

const TOKENS = '{{candidateName}}, {{designation}}, {{companyName}}, {{currency}}, {{ctcAnnual}}, {{fixedAnnual}}, {{variableAnnual}}, {{joiningDate}}, {{workMode}}, {{workLocation}}, {{reportingManager}}, {{expiryDate}}, {{referenceNumber}}, {{offerDate}}';
// Uploaded Word (.docx) templates accept BOTH Zoho-style «Module.Field» names and
// simple {tokens}. Categorized so recruiters can reuse their existing Zoho letters.
const DOCX_FIELD_GROUPS = [
  { title: 'Candidate', fields: ['«Candidates.First Name»', '«Candidates.Last Name»', '«Candidates.Name»', '«Candidates.Email»'] },
  { title: 'Company', fields: ['«Company.Name»'] },
  { title: 'Offer', fields: ['«Offers.Offer ID»', '«Offers.Designation»', '«Offers.Department»', '«Offers.Location»', '«Offers.Work Mode»', '«Offers.Reporting To»', '«Offers.Expected Joining Date»', '«Offers.Expiry Date»', '«Offers.Working Days»', '«Offers.Contract Start Date»', '«Offers.Contract End Date»', '«Offers.Offer Date»'] },
  { title: 'Salary', fields: ['«Offers.Currency»', '«Offers.CTC/annum»', '«Offers.CTC In Words»', '«Offers.CTC Monthly»', '«Offers.Basic/annum»', '«Offers.HRA/annum»', '…and one per annexure row: «Offers.<Row>/annum» + «Offers.<Row>/month»'] },
];

function blank() {
  return { id: null, name: 'New offer template', description: '', isDefault: false, letterBody: `Dear {{candidateName}},\n\nWe are pleased to offer you the position of {{designation}} at {{companyName}} with an annual CTC of {{currency}} {{ctcAnnual}}.\n\nProposed joining date: {{joiningDate}}\n\nWarm regards,\n{{companyName}} Hiring Team` };
}

// Editable offer-letter templates: name, description, default flag, and the
// letter body with merge tokens rendered into the downloadable offer letter.
export function OfferTemplatesManager({ initialTemplates = [] }) {
  const { push } = useToast();
  const [templates, setTemplates] = useState(initialTemplates);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  function edit(field, value) {
    setEditing((c) => ({ ...c, [field]: value }));
  }

  async function save() {
    if (!editing.name.trim()) {
      push({ tone: 'error', title: 'Name required', description: 'Give the template a name.' });
      return;
    }
    setSaving(true);
    try {
      const isNew = !editing.id;
      const url = isNew ? '/api/recruiter/ats/offer-templates' : `/api/recruiter/ats/offer-templates/${editing.id}`;
      const response = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editing.name.trim(), description: editing.description, isDefault: editing.isDefault, letterBody: editing.letterBody }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) throw new Error(body?.message || 'Could not save.');
      const saved = body.data;
      setTemplates((list) => (isNew ? [...list, saved] : list.map((t) => (t.id === saved.id ? saved : t))));
      setEditing(null);
      push({ tone: 'success', title: 'Saved', description: `${saved.name} saved.` });
    } catch (error) {
      push({ tone: 'error', title: 'Could not save', description: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function uploadDocument(template, file) {
    if (!file) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set('file', file);
      const response = await fetch(`/api/recruiter/ats/offer-templates/${template.id}/document`, { method: 'POST', body: fd });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) throw new Error(body?.message || 'Could not upload.');
      const saved = body.data;
      setTemplates((list) => list.map((t) => (t.id === saved.id ? saved : t)));
      push({ tone: 'success', title: 'Document uploaded', description: `${saved.documentFilename} attached. Offers now merge into this Word file.` });
    } catch (error) {
      push({ tone: 'error', title: 'Upload failed', description: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function remove(template) {
    if (!template.id) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/recruiter/ats/offer-templates/${template.id}`, { method: 'DELETE' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) throw new Error(body?.message || 'Could not delete.');
      setTemplates((list) => list.filter((t) => t.id !== template.id));
      push({ tone: 'success', title: 'Deleted', description: `${template.name} removed.` });
    } catch (error) {
      push({ tone: 'error', title: 'Could not delete', description: error.message });
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Template name" value={editing.name} onChange={(e) => edit('name', e.target.value)} />
          <label className="flex items-end gap-2 pb-2 text-sm text-[var(--color-text)]">
            <input type="checkbox" checked={editing.isDefault} onChange={(e) => edit('isDefault', e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
            Use as default template
          </label>
        </div>
        <Input label="Description (optional)" value={editing.description || ''} onChange={(e) => edit('description', e.target.value)} />
        <Textarea label="Offer letter body" value={editing.letterBody} onChange={(e) => edit('letterBody', e.target.value)} textareaClassName="min-h-64" helpText={`Merge tokens: ${TOKENS}`} />
        <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--color-border)] pt-4">
          <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={save} loading={saving}>Save template</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
            <p className="text-sm font-semibold text-[var(--color-text)]">✍️ Text body</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Edit the letter text directly with simple {'{tokens}'}. Fastest for a standard letter.</p>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
            <p className="text-sm font-semibold text-[var(--color-text)]">📄 Upload a Word file</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Design your company&apos;s letter in Word using <span className="font-semibold">«Module.Field»</span> merge fields and upload the .docx. Offers download as your Word document.</p>
          </div>
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--brand)]">Merge fields reference</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {DOCX_FIELD_GROUPS.map((group) => (
              <div key={group.title} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-2 text-xs">
                <p className="font-semibold text-[var(--color-text)]">{group.title}</p>
                <p className="mt-1 text-[var(--color-text-secondary)]">{group.fields.join(', ')}</p>
              </div>
            ))}
            <p className="text-xs text-[var(--color-text-secondary)] sm:col-span-2">Any <span className="font-semibold">Additional information</span> field you add when generating an offer is also usable as «Offers.&lt;Label&gt;». Text-body tokens: {TOKENS}</p>
          </div>
        </details>
      </Card>
      <div className="flex justify-end">
        <Button type="button" onClick={() => setEditing(blank())}><Plus size={16} /> New template</Button>
      </div>
      {templates.length === 0 ? <Card><p className="text-sm text-[var(--color-text-secondary)]">No offer templates yet.</p></Card> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => (
          <Card key={template.id} className="space-y-2">
            <h3 className="text-lg font-semibold text-[var(--color-text)]">{template.name}{template.isDefault ? ' • default' : ''}</h3>
            {template.description ? <p className="text-sm text-[var(--color-text-secondary)]">{template.description}</p> : null}
            <p className="line-clamp-2 text-sm text-[var(--color-text-secondary)]">{template.letterBody}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Word file: {template.documentFilename ? <span className="font-semibold text-[var(--color-text)]">{template.documentFilename}</span> : 'none (uses text body)'}</p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(JSON.parse(JSON.stringify(template)))}>Edit</Button>
              <label className="inline-flex cursor-pointer items-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text)]">
                {template.documentFilename ? 'Replace .docx' : 'Upload .docx'}
                <input type="file" accept=".docx" className="hidden" onChange={(e) => { uploadDocument(template, e.target.files?.[0]); e.target.value = ''; }} disabled={saving} />
              </label>
              <Button type="button" variant="outline" size="sm" onClick={() => remove(template)} disabled={saving}>Delete</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
