'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, Copy, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

// Recruiter-facing answer types (friendly label -> stored enum). Mirrors the
// create wizard's Questions stage so the edit-time builder reads the same way.
const QUESTION_TYPES = [
  { value: 'SHORT_TEXT', label: 'Short text' },
  { value: 'LONG_TEXT', label: 'Paragraph' },
  { value: 'YES_NO', label: 'Yes / No' },
  { value: 'SINGLE_SELECT', label: 'Single choice' },
  { value: 'MULTI_SELECT', label: 'Multiple choice' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'CURRENCY', label: 'Amount / salary' },
  { value: 'DATE', label: 'Date' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'URL', label: 'Website / URL' },
  { value: 'FILE_UPLOAD', label: 'File upload' },
];

// Plain-language auto-screening vocabulary (the recruiter never sees raw enums).
const RULE_OPERATORS = [
  { value: 'EQUALS', label: 'is equal to' },
  { value: 'NOT_EQUALS', label: 'is not equal to' },
  { value: 'GREATER_THAN_OR_EQUAL', label: 'is at least' },
  { value: 'GREATER_THAN', label: 'is more than' },
  { value: 'LESS_THAN_OR_EQUAL', label: 'is at most' },
  { value: 'LESS_THAN', label: 'is less than' },
  { value: 'CONTAINS', label: 'contains' },
  { value: 'DOES_NOT_CONTAIN', label: 'does not contain' },
  { value: 'IN', label: 'is one of' },
  { value: 'NOT_IN', label: 'is none of' },
];
const RULE_OUTCOMES = [
  { value: 'MEETS_CRITERIA', label: 'Looks good — meets criteria' },
  { value: 'REVIEW_REQUIRED', label: 'Flag for manual review' },
  { value: 'DOES_NOT_MEET_CRITERIA', label: 'Does not meet — deprioritise' },
];

// Quick-add suggestions, matching the create wizard's chips.
const SUGGESTED_QUESTIONS = [
  { questionText: 'What is your total professional experience in years?', questionType: 'NUMBER', required: true },
  { questionText: 'What is your current annual CTC?', questionType: 'SHORT_TEXT', required: false },
  { questionText: 'What is your expected annual CTC?', questionType: 'SHORT_TEXT', required: false },
  { questionText: 'What is your notice period?', questionType: 'SINGLE_SELECT', required: true, options: 'Immediate, 15 days, 30 days, 60 days, 90 days' },
  { questionText: 'Are you willing to work from the job location?', questionType: 'YES_NO', required: true },
];

const typeLabel = (value) => QUESTION_TYPES.find((type) => type.value === value)?.label || value;

function supportsOptions(type) {
  return ['SINGLE_SELECT', 'MULTI_SELECT'].includes(type);
}
function supportsText(type) {
  return ['SHORT_TEXT', 'LONG_TEXT', 'EMAIL', 'PHONE', 'URL'].includes(type);
}
function supportsNumber(type) {
  return ['NUMBER', 'CURRENCY'].includes(type);
}
function supportsRules(type) {
  return type !== 'FILE_UPLOAD';
}

export function ScreeningQuestionBuilder({
  job,
  addJobQuestionAction,
  deleteJobQuestionAction,
  duplicateJobQuestionAction,
  reorderJobQuestionsAction,
  updateJobQuestionAction,
}) {
  const [draft, setDraft] = useState({ questionText: '', questionType: 'SHORT_TEXT', options: '', required: false });
  const [showRule, setShowRule] = useState(false);
  const [newQuestionError, setNewQuestionError] = useState('');
  const questions = useMemo(() => job.screeningQuestions || [], [job.screeningQuestions]);
  const questionIds = useMemo(() => questions.map((item) => item.id), [questions]);

  function setDraftField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function applySuggestion(suggestion) {
    setDraft({
      questionText: suggestion.questionText,
      questionType: suggestion.questionType,
      options: suggestion.options || '',
      required: Boolean(suggestion.required),
    });
    setNewQuestionError('');
  }

  function validateQuestionSubmission(event) {
    if (supportsOptions(draft.questionType)) {
      const options = String(draft.options || '').split(',').map((item) => item.trim()).filter(Boolean);
      if (options.length < 2) {
        event.preventDefault();
        setNewQuestionError('Select questions require at least two options.');
        return false;
      }
    }
    setNewQuestionError('');
    return true;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <Card>
        <h2 className="font-[var(--font-display)] text-2xl font-semibold">Screening questions</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">These are the questions candidates answer when they apply. Saved with the job, so editing a template later never changes an already-published form.</p>
        <div className="mt-5 space-y-4">
          {questions.map((question, index) => {
            const moveUpOrder = [...questionIds];
            const moveDownOrder = [...questionIds];
            if (index > 0) [moveUpOrder[index - 1], moveUpOrder[index]] = [moveUpOrder[index], moveUpOrder[index - 1]];
            if (index < questionIds.length - 1) [moveDownOrder[index], moveDownOrder[index + 1]] = [moveDownOrder[index + 1], moveDownOrder[index]];
            return (
              <div key={question.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-text)]">{index + 1}. {question.questionText}</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{typeLabel(question.questionType)} • {question.required ? 'Required' : 'Optional'}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {index > 0 ? <form action={reorderJobQuestionsAction.bind(null, job.id, moveUpOrder)}><Button type="submit" variant="ghost" size="sm" aria-label={`Move ${question.questionText} up`}>Move up</Button></form> : null}
                    {index < questionIds.length - 1 ? <form action={reorderJobQuestionsAction.bind(null, job.id, moveDownOrder)}><Button type="submit" variant="ghost" size="sm" aria-label={`Move ${question.questionText} down`}>Move down</Button></form> : null}
                  </div>
                </div>
                <form action={updateJobQuestionAction.bind(null, job.id, question.id)} className="mt-4 grid items-start gap-3 md:grid-cols-2">
                  <Input label="Question text" name="questionText" defaultValue={question.questionText} required />
                  <Select label="Answer type" name="questionType" defaultValue={question.questionType}>
                    {QUESTION_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </Select>
                  <div className="md:col-span-2">
                    <Input label="Answer options" name="options" defaultValue={(question.config?.options || []).map((item) => item.value).join(', ')} placeholder="Comma-separated (for choice questions)" helpText="Only used for single/multiple choice." />
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)]"><input name="required" type="checkbox" defaultChecked={question.required} /> Required</label>
                  <div className="flex flex-wrap gap-2 md:col-span-2">
                    <Button type="submit" size="sm">Save</Button>
                    <Button type="submit" variant="outline" size="sm" formAction={duplicateJobQuestionAction.bind(null, job.id, question.id)}><Copy size={14} aria-hidden="true" />Duplicate</Button>
                    <Button type="submit" variant="danger" size="sm" formAction={deleteJobQuestionAction.bind(null, job.id, question.id)}><Trash2 size={14} aria-hidden="true" />Remove</Button>
                  </div>
                </form>
              </div>
            );
          })}
          {questions.length === 0 ? <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">No screening questions yet. Add one on the right, or pick a suggestion.</p> : null}
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Add custom question</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Tap a suggestion to start, or write your own.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((suggestion) => (
              <button key={suggestion.questionText} type="button" onClick={() => applySuggestion(suggestion)} className="rounded-full border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
                {suggestion.questionText}
              </button>
            ))}
          </div>
          <form
            action={addJobQuestionAction.bind(null, job.id)}
            className="mt-5 grid items-start gap-4"
            onSubmit={validateQuestionSubmission}
          >
            <Input label="Question text" name="questionText" value={draft.questionText} onChange={(event) => setDraftField('questionText', event.target.value)} placeholder="e.g. What is your notice period?" required />
            <Select label="Question type" name="questionType" value={draft.questionType} onChange={(event) => setDraftField('questionType', event.target.value)}>
              {QUESTION_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </Select>
            {supportsOptions(draft.questionType) ? (
              <Input label="Answer options" name="options" value={draft.options} onChange={(event) => setDraftField('options', event.target.value)} placeholder="Immediate, 30 days, 60 days" helpText="Separate each choice with a comma (at least two)." />
            ) : null}
            {supportsText(draft.questionType) ? (
              <div className="grid items-start gap-4 md:grid-cols-2">
                <Input label="Min text length" name="minTextLength" type="number" min="0" />
                <Input label="Max text length" name="maxTextLength" type="number" min="0" />
              </div>
            ) : null}
            {supportsNumber(draft.questionType) ? (
              <div className="grid items-start gap-4 md:grid-cols-2">
                <Input label="Minimum accepted" name="minNumber" type="number" />
                <Input label="Maximum accepted" name="maxNumber" type="number" />
              </div>
            ) : null}
            {draft.questionType === 'FILE_UPLOAD' ? (
              <div className="grid items-start gap-4 md:grid-cols-2">
                <Input label="Allowed file types" name="allowedFileTypes" placeholder="pdf, doc, docx" />
                <Input label="Max file size (bytes)" name="maxFileSizeBytes" type="number" min="1" />
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)]"><input name="required" type="checkbox" checked={draft.required} onChange={(event) => setDraftField('required', event.target.checked)} /> Required</label>

            {supportsRules(draft.questionType) ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-3">
                <button type="button" onClick={() => setShowRule((current) => !current)} className="flex w-full items-center justify-between text-sm font-semibold text-[var(--color-text)]">
                  <span>Auto-screening rule <span className="font-normal text-[var(--color-text-muted)]">(optional)</span></span>
                  <ChevronDown size={16} aria-hidden="true" className={showRule ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>
                {showRule ? (
                  <div className="mt-3 grid items-start gap-4 md:grid-cols-2">
                    <Select label="When the answer" name="ruleOperator" defaultValue="">
                      <option value="">No rule — just collect the answer</option>
                      {RULE_OPERATORS.map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
                    </Select>
                    <Input label="This value" name="ruleValue" placeholder="e.g. 5" />
                    <Select label="Then mark the candidate" name="ruleOutcome" defaultValue="REVIEW_REQUIRED">
                      {RULE_OUTCOMES.map((outcome) => <option key={outcome.value} value={outcome.value}>{outcome.label}</option>)}
                    </Select>
                    <Input label="Note (optional)" name="ruleReason" placeholder="Shown to your team" />
                  </div>
                ) : null}
              </div>
            ) : null}

            {draft.questionText ? (
              <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-muted)] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Candidate preview</p>
                <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">{draft.questionText}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{draft.required ? 'Required' : 'Optional'} • {typeLabel(draft.questionType)}</p>
              </div>
            ) : null}
            {newQuestionError ? <p className="text-sm text-[var(--color-danger)]">{newQuestionError}</p> : null}
            <Button type="submit" className="justify-self-start"><Plus size={16} aria-hidden="true" />Add custom question</Button>
          </form>
        </Card>

      </div>
    </div>
  );
}
