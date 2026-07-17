'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';

const questionTypes = ['YES_NO', 'SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'CURRENCY', 'DATE', 'EMAIL', 'PHONE', 'URL', 'SINGLE_SELECT', 'MULTI_SELECT', 'FILE_UPLOAD'];
const ruleOperators = ['EQUALS', 'NOT_EQUALS', 'LESS_THAN', 'LESS_THAN_OR_EQUAL', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'CONTAINS', 'DOES_NOT_CONTAIN', 'IN', 'NOT_IN'];
const outcomes = ['MEETS_CRITERIA', 'REVIEW_REQUIRED', 'DOES_NOT_MEET_CRITERIA'];

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
  templates,
  addJobQuestionAction,
  addJobQuestionFromLibraryAction,
  createScreeningTemplateAction,
  deleteJobQuestionAction,
  duplicateJobQuestionAction,
  reorderJobQuestionsAction,
  updateJobQuestionAction,
}) {
  const [newQuestionType, setNewQuestionType] = useState('SHORT_TEXT');
  const [newQuestionError, setNewQuestionError] = useState('');
  const questions = useMemo(() => job.screeningQuestions || [], [job.screeningQuestions]);

  const questionIds = useMemo(() => questions.map((item) => item.id), [questions]);

  function validateQuestionSubmission(event, questionType, optionsValue) {
    if (supportsOptions(questionType)) {
      const options = String(optionsValue || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
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
        <p className="mt-2 text-sm text-[var(--muted)]">Questions are stored on the job as snapshots so later template edits do not silently change published application forms.</p>
        <div className="mt-5 space-y-4">
          {questions.map((question, index) => {
            const moveUpOrder = [...questionIds];
            const moveDownOrder = [...questionIds];
            if (index > 0) [moveUpOrder[index - 1], moveUpOrder[index]] = [moveUpOrder[index], moveUpOrder[index - 1]];
            if (index < questionIds.length - 1) [moveDownOrder[index], moveDownOrder[index + 1]] = [moveDownOrder[index + 1], moveDownOrder[index]];
            return (
              <div key={question.id} className="rounded-[24px] border border-[var(--line)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{question.questionText}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{question.questionType} • {question.required ? 'Required' : 'Optional'}</p>
                    {question.helpText ? <p className="mt-2 text-sm text-[var(--muted)]">{question.helpText}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    {index > 0 ? <form action={reorderJobQuestionsAction.bind(null, job.id, moveUpOrder)}><button aria-label={`Move ${question.questionText} up`} className="rounded-2xl border border-[var(--line)] px-3 py-2 text-xs font-semibold">Move up</button></form> : null}
                    {index < questionIds.length - 1 ? <form action={reorderJobQuestionsAction.bind(null, job.id, moveDownOrder)}><button aria-label={`Move ${question.questionText} down`} className="rounded-2xl border border-[var(--line)] px-3 py-2 text-xs font-semibold">Move down</button></form> : null}
                  </div>
                </div>
                <form action={updateJobQuestionAction.bind(null, job.id, question.id)} className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Question text</span>
                    <input name="questionText" defaultValue={question.questionText} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" required />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">Question type</span>
                    <select name="questionType" defaultValue={question.questionType} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3">
                      {questionTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </label>
                  <label className="text-sm md:col-span-2">
                    <span className="mb-1 block font-medium">Options</span>
                    <input name="options" defaultValue={(question.config?.options || []).map((item) => item.value).join(', ')} className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Comma-separated options" />
                  </label>
                  <label className="flex items-center gap-2 text-sm"><input name="required" type="checkbox" defaultChecked={question.required} /> Required</label>
                  <div className="flex flex-wrap gap-2 md:col-span-2">
                    <button className="rounded-2xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white">Save question</button>
                    <button formAction={duplicateJobQuestionAction.bind(null, job.id, question.id)} className="rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-semibold">Duplicate</button>
                    <button formAction={deleteJobQuestionAction.bind(null, job.id, question.id)} className="rounded-2xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700">Remove</button>
                  </div>
                </form>
              </div>
            );
          })}
          {questions.length === 0 ? <p className="text-sm text-[var(--muted)]">No screening questions configured yet.</p> : null}
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Add custom question</h2>
          <form
            action={addJobQuestionAction.bind(null, job.id)}
            className="mt-5 grid gap-3"
            onSubmit={(event) => {
              const formData = new FormData(event.currentTarget);
              validateQuestionSubmission(event, String(formData.get('questionType') || ''), formData.get('options'));
            }}
          >
            <label className="text-sm">
              <span className="mb-1 block font-medium">Question text</span>
              <input name="questionText" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Question text" required />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Question type</span>
              <select
                name="questionType"
                className="w-full rounded-2xl border border-[var(--line)] px-4 py-3"
                value={newQuestionType}
                onChange={(event) => setNewQuestionType(event.target.value)}
              >
                {questionTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            {supportsOptions(newQuestionType) ? (
              <label className="text-sm">
                <span className="mb-1 block font-medium">Options</span>
                <input name="options" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Comma-separated options" />
              </label>
            ) : null}
            {supportsText(newQuestionType) ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Min text length</span>
                  <input name="minTextLength" type="number" min="0" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Max text length</span>
                  <input name="maxTextLength" type="number" min="0" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
                </label>
              </div>
            ) : null}
            {supportsNumber(newQuestionType) ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Min number</span>
                  <input name="minNumber" type="number" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Max number</span>
                  <input name="maxNumber" type="number" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
                </label>
              </div>
            ) : null}
            {newQuestionType === 'FILE_UPLOAD' ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Allowed file types</span>
                  <input name="allowedFileTypes" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="pdf, doc, docx" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Max file size bytes</span>
                  <input name="maxFileSizeBytes" type="number" min="1" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
                </label>
              </div>
            ) : null}
            {supportsRules(newQuestionType) ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Rule operator</span>
                  <select name="ruleOperator" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="">
                    <option value="">No screening rule</option>
                    {ruleOperators.map((operator) => <option key={operator} value={operator}>{operator}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Rule value</span>
                  <input name="ruleValue" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Rule outcome</span>
                  <select name="ruleOutcome" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="REVIEW_REQUIRED">
                    {outcomes.map((outcome) => <option key={outcome} value={outcome}>{outcome}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Rule reason</span>
                  <input name="ruleReason" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" />
                </label>
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-sm"><input name="required" type="checkbox" /> Required</label>
            {newQuestionError ? <p className="text-sm text-rose-600">{newQuestionError}</p> : null}
            <button className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Add custom question</button>
          </form>
        </Card>

        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Question library</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Reusable organisation-scoped templates. Adding one to this job creates a job-owned copy.</p>
          <div className="mt-5 space-y-3">
            {templates.items?.map((template) => (
              <div key={template.id} className="rounded-[24px] border border-[var(--line)] p-4">
                <p className="font-semibold">{template.questionText}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{template.questionType} • Used {template.usageCount} times</p>
                <form action={addJobQuestionFromLibraryAction.bind(null, job.id)} className="mt-3">
                  <input type="hidden" name="templateId" value={template.id} />
                  <button className="rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-semibold">Add to job</button>
                </form>
              </div>
            ))}
          </div>
          <form action={createScreeningTemplateAction} className="mt-6 grid gap-3">
            <h3 className="font-semibold">Create reusable template</h3>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Template question text</span>
              <input name="questionText" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Template question text" required />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Internal label</span>
              <input name="internalLabel" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Internal label" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Template question type</span>
              <select name="questionType" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" defaultValue="SHORT_TEXT">
                {questionTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Template options</span>
              <input name="options" className="w-full rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Comma-separated options" />
            </label>
            <button className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Save template</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
