"use client";

import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

function formatTemplateOption(template) {
  const version = template?.versions?.[0]?.version;
  const scope = template?.scope === 'SYSTEM' ? 'System' : 'Organization';
  return `${template.name}${version ? ` | v${version}` : ''} | ${scope}`;
}

export function TemplateSelector({
  templates,
  value,
  onChange,
  onLoadTemplate,
  disabled = false,
}) {
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
      <Select
        label="Template"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || !templates.length}
        helpText="Choose a system or organization template to seed a new draft."
      >
        <option value="">No template selected</option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {formatTemplateOption(template)}
          </option>
        ))}
      </Select>
      <div className="flex items-end">
        <Button type="button" variant="outline" onClick={onLoadTemplate} disabled={disabled || !value}>
          Load template
        </Button>
      </div>
    </div>
  );
}
