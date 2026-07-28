"use client";

import { GitCompareArrows } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function compareSummary(left, right) {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  if (!normalizedLeft && !normalizedRight) return { state: 'same' };
  if (!normalizedLeft) return { state: 'added' };
  if (!normalizedRight) return { state: 'removed' };
  if (normalizedLeft !== normalizedRight) return { state: 'modified' };
  return { state: 'same' };
}

function compareList(left, right) {
  const leftList = normalizeList(left);
  const rightList = normalizeList(right);
  const leftSet = new Set(leftList);
  const rightSet = new Set(rightList);
  return {
    left: leftList.map((item) => ({
      value: item,
      state: rightSet.has(item) ? 'same' : 'removed',
    })),
    right: rightList.map((item) => ({
      value: item,
      state: leftSet.has(item) ? 'same' : 'added',
    })),
  };
}

function toneForState(state) {
  if (state === 'added') return 'success';
  if (state === 'removed') return 'danger';
  if (state === 'modified') return 'warning';
  return 'neutral';
}

function labelForState(state) {
  if (state === 'added') return 'Added';
  if (state === 'removed') return 'Removed';
  if (state === 'modified') return 'Modified';
  return 'Unchanged';
}

function CompareColumn({ title, sections, side }) {
  return (
    <div className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-4">
      <h4 className="text-sm font-semibold text-[var(--color-text)]">{title}</h4>
      {sections.map((section) => (
        <div key={`${side}-${section.key}`} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--color-text)]">{section.label}</p>
            <Badge tone={toneForState(section.state)}>{labelForState(section.state)}</Badge>
          </div>
          {section.type === 'summary' ? (
            <p
              className={`rounded-[var(--radius-lg)] px-3 py-3 text-sm leading-6 ${
                section.state === 'modified'
                  ? 'bg-amber-50 text-amber-950'
                  : section.state === 'added'
                    ? 'bg-emerald-50 text-emerald-950'
                    : section.state === 'removed'
                      ? 'bg-rose-50 text-rose-950'
                      : 'bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]'
              }`}
            >
              {section.value || 'Not provided'}
            </p>
          ) : (
            <ul className="grid gap-2">
              {section.items.length ? section.items.map((item, index) => (
                <li
                  key={`${side}-${section.key}-${index}`}
                  className={`rounded-[var(--radius-lg)] px-3 py-3 text-sm ${
                    item.state === 'added'
                      ? 'bg-emerald-50 text-emerald-950'
                      : item.state === 'removed'
                        ? 'bg-rose-50 text-rose-950'
                        : 'bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]'
                  }`}
                >
                  {item.value}
                </li>
              )) : (
                <li className="rounded-[var(--radius-lg)] bg-[var(--color-bg-muted)] px-3 py-3 text-sm text-[var(--color-text-secondary)]">
                  Not provided
                </li>
              )}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export function JobDescriptionComparisonView({
  current,
  selected,
  currentLabel = 'Current Draft',
  selectedLabel = 'Selected Version',
  hidden = false,
}) {
  if (hidden) return null;

  if (!current || !selected) {
    return (
      <Card>
        <EmptyState
          icon={GitCompareArrows}
          title="Select a version to compare"
          description="Pick a historical version from the history panel to compare it with the current draft."
        />
      </Card>
    );
  }

  const summaryState = compareSummary(current.summary, selected.summary).state;
  const responsibilities = compareList(current.responsibilities, selected.responsibilities);
  const requiredSkills = compareList(current.requiredSkills, selected.requiredSkills);
  const screeningQuestions = compareList(current.screeningQuestions, selected.screeningQuestions);

  const leftSections = [
    {
      key: 'summary',
      label: 'Summary',
      type: 'summary',
      state: summaryState,
      value: normalizeText(current.summary),
    },
    {
      key: 'responsibilities',
      label: 'Responsibilities',
      type: 'list',
      state: responsibilities.left.some((item) => item.state !== 'same') ? 'modified' : 'same',
      items: responsibilities.left,
    },
    {
      key: 'requiredSkills',
      label: 'Skills',
      type: 'list',
      state: requiredSkills.left.some((item) => item.state !== 'same') ? 'modified' : 'same',
      items: requiredSkills.left,
    },
    {
      key: 'screeningQuestions',
      label: 'Screening Questions',
      type: 'list',
      state: screeningQuestions.left.some((item) => item.state !== 'same') ? 'modified' : 'same',
      items: screeningQuestions.left,
    },
  ];

  const rightSections = [
    {
      key: 'summary',
      label: 'Summary',
      type: 'summary',
      state: summaryState,
      value: normalizeText(selected.summary),
    },
    {
      key: 'responsibilities',
      label: 'Responsibilities',
      type: 'list',
      state: responsibilities.right.some((item) => item.state !== 'same') ? 'modified' : 'same',
      items: responsibilities.right,
    },
    {
      key: 'requiredSkills',
      label: 'Skills',
      type: 'list',
      state: requiredSkills.right.some((item) => item.state !== 'same') ? 'modified' : 'same',
      items: requiredSkills.right,
    },
    {
      key: 'screeningQuestions',
      label: 'Screening Questions',
      type: 'list',
      state: screeningQuestions.right.some((item) => item.state !== 'same') ? 'modified' : 'same',
      items: screeningQuestions.right,
    },
  ];

  return (
    <Card>
      <div>
        <h3 className="text-lg font-semibold text-[var(--color-text)]">Compare versions</h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Review added, removed, and modified content before deciding which draft to keep active.
        </p>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <CompareColumn title={currentLabel} sections={leftSections} side="left" />
        <CompareColumn title={selectedLabel} sections={rightSections} side="right" />
      </div>
    </Card>
  );
}
