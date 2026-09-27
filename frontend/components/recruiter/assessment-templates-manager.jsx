"use client";

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';

function blankTemplate() {
  return {
    id: null,
    name: 'New assessment form',
    description: '',
    isDefault: false,
    sections: [{ title: 'Section 1', criteria: [{ label: 'Criterion 1', type: 'RATING', required: true }] }],
  };
}

// Editable interview scorecard templates: recruiters can add/edit sections and
// criteria, mark a default, and save. Used by the interview schedule popup.
export function AssessmentTemplatesManager({ initialTemplates = [] }) {
  const { push } = useToast();
  const [templates, setTemplates] = useState(initialTemplates);
  const [editing, setEditing] = useState(null); // the template object being edited (draft)
  const [saving, setSaving] = useState(false);

  function startEdit(template) {
    setEditing(JSON.parse(JSON.stringify(template)));
  }
  function editField(field, value) {
    setEditing((c) => ({ ...c, [field]: value }));
  }
  function editSection(si, field, value) {
    setEditing((c) => ({ ...c, sections: c.sections.map((s, i) => (i === si ? { ...s, [field]: value } : s)) }));
  }
  function editCriterion(si, ci, field, value) {
    setEditing((c) => ({
      ...c,
      sections: c.sections.map((s, i) => (i === si
        ? { ...s, criteria: s.criteria.map((cr, j) => (j === ci ? { ...cr, [field]: value } : cr)) }
        : s)),
    }));
  }
  function addSection() {
    setEditing((c) => ({ ...c, sections: [...c.sections, { title: `Section ${c.sections.length + 1}`, criteria: [{ label: 'Criterion 1', type: 'RATING', required: false }] }] }));
  }
  function removeSection(si) {
    setEditing((c) => ({ ...c, sections: c.sections.filter((_, i) => i !== si) }));
  }
  function addCriterion(si) {
    setEditing((c) => ({ ...c, sections: c.sections.map((s, i) => (i === si ? { ...s, criteria: [...s.criteria, { label: '', type: 'RATING', required: false }] } : s)) }));
  }
  function removeCriterion(si, ci) {
    setEditing((c) => ({ ...c, sections: c.sections.map((s, i) => (i === si ? { ...s, criteria: s.criteria.filter((_, j) => j !== ci) } : s)) }));
  }

  async function save() {
    if (!editing.name.trim()) {
      push({ tone: 'error', title: 'Name required', description: 'Give the form a name.' });
      return;
    }
    setSaving(true);
    try {
      const isNew = !editing.id;
      const url = isNew ? '/api/recruiter/ats/assessment-templates' : `/api/recruiter/ats/assessment-templates/${editing.id}`;
      const response = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editing.name.trim(), description: editing.description, isDefault: editing.isDefault, sections: editing.sections }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) throw new Error(body?.message || 'Could not save the form.');
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

  async function remove(template) {
    if (!template.id) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/recruiter/ats/assessment-templates/${template.id}`, { method: 'DELETE' });
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
      <Card className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Form name" value={editing.name} onChange={(e) => editField('name', e.target.value)} />
          <label className="flex items-end gap-2 pb-2 text-sm text-[var(--color-text)]">
            <input type="checkbox" checked={editing.isDefault} onChange={(e) => editField('isDefault', e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
            Use as default form
          </label>
        </div>
        <Input label="Description (optional)" value={editing.description || ''} onChange={(e) => editField('description', e.target.value)} />

        {editing.sections.map((section, si) => (
          <div key={si} className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
            <div className="flex items-center gap-3">
              <Input className="flex-1" label={`Section ${si + 1} title`} value={section.title} onChange={(e) => editSection(si, 'title', e.target.value)} />
              <button type="button" onClick={() => removeSection(si)} className="mt-6 text-[var(--color-danger)]" title="Remove section"><Trash2 size={16} /></button>
            </div>
            {section.criteria.map((c, ci) => (
              <div key={ci} className="flex flex-wrap items-end gap-2">
                <Input className="min-w-[200px] flex-1" label={ci === 0 ? 'Criterion' : undefined} value={c.label} onChange={(e) => editCriterion(si, ci, 'label', e.target.value)} placeholder="e.g. Communication" />
                <Select label={ci === 0 ? 'Type' : undefined} value={c.type} onChange={(e) => editCriterion(si, ci, 'type', e.target.value)}>
                  <option value="RATING">Rating</option>
                  <option value="TEXT">Text</option>
                </Select>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input type="checkbox" checked={c.required} onChange={(e) => editCriterion(si, ci, 'required', e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
                  Req
                </label>
                <button type="button" onClick={() => removeCriterion(si, ci)} className="pb-2 text-[var(--color-danger)]" title="Remove"><Trash2 size={15} /></button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => addCriterion(si)}><Plus size={14} /> Add criterion</Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addSection}><Plus size={16} /> Add section</Button>

        <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--color-border)] pt-4">
          <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={save} loading={saving}>Save form</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => startEdit(blankTemplate())}><Plus size={16} /> New form</Button>
      </div>
      {templates.length === 0 ? <Card><p className="text-sm text-[var(--color-text-secondary)]">No assessment forms yet.</p></Card> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => (
          <Card key={template.id} className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-[var(--color-text)]">{template.name}{template.isDefault ? ' • default' : ''}</h3>
            </div>
            {template.description ? <p className="text-sm text-[var(--color-text-secondary)]">{template.description}</p> : null}
            <p className="text-sm text-[var(--color-text-secondary)]">{(template.sections || []).length} section{(template.sections || []).length === 1 ? '' : 's'} • {(template.sections || []).reduce((n, s) => n + (s.criteria?.length || 0), 0)} criteria</p>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => startEdit(template)}>Edit</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => remove(template)} disabled={saving}>Delete</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
