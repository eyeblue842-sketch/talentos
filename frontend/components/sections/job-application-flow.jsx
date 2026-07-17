'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const steps = [
  'Select Resume',
  'Screening Questions',
  'Review Application',
  'Consent and Submit',
  'Success',
];

function inputClassName() {
  return 'w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm';
}

function formatDate(value) {
  return new Date(value).toLocaleDateString();
}

function questionKey(question) {
  return question.internalLabel || question.questionText;
}

function normalizeReviewValue(question, value, uploads) {
  if (question.questionType === 'MULTI_SELECT') {
    return Array.isArray(value) ? value.join(', ') : '';
  }
  if (question.questionType === 'FILE_UPLOAD') {
    const file = uploads[question.id];
    return file?.filename || 'Uploaded file';
  }
  if (question.questionType === 'YES_NO') {
    return value === true ? 'Yes' : value === false ? 'No' : '';
  }
  return value == null ? '' : String(value);
}

function QuestionField({ question, value, onChange, upload, onUpload, uploadPending }) {
  const className = inputClassName();
  const options = question.config?.options || [];

  if (question.questionType === 'LONG_TEXT') {
    return <textarea id={question.id} className={`${className} min-h-32`} value={value || ''} placeholder={question.placeholder || ''} onChange={(event) => onChange(event.target.value)} />;
  }

  if (question.questionType === 'YES_NO') {
    return (
      <div className="flex gap-3">
        {['Yes', 'No'].map((label) => {
          const nextValue = label === 'Yes';
          return (
            <button
              key={label}
              type="button"
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${value === nextValue ? 'border-[var(--brand)] bg-[var(--soft)] text-[var(--brand)]' : 'border-[var(--line)]'}`}
              onClick={() => onChange(nextValue)}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  if (question.questionType === 'SINGLE_SELECT') {
    return (
      <select id={question.id} className={className} value={value || ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select an option</option>
        {options.map((option) => <option key={option.id || option.value} value={option.value}>{option.label}</option>)}
      </select>
    );
  }

  if (question.questionType === 'MULTI_SELECT') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        {options.map((option) => (
          <label key={option.id || option.value} className="flex items-center gap-3 rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={(event) => {
                if (event.target.checked) {
                  onChange([...selected, option.value]);
                } else {
                  onChange(selected.filter((item) => item !== option.value));
                }
              }}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.questionType === 'FILE_UPLOAD') {
    return (
      <div className="space-y-3">
        <input
          id={question.id}
          className={className}
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
          }}
          aria-describedby={`${question.id}-help`}
        />
        {upload ? <p className="text-sm text-[var(--muted)]">{upload.filename}</p> : null}
        {uploadPending ? <p className="text-sm text-[var(--muted)]">Uploading file…</p> : null}
      </div>
    );
  }

  const typeMap = {
    SHORT_TEXT: 'text',
    NUMBER: 'number',
    CURRENCY: 'number',
    DATE: 'date',
    EMAIL: 'email',
    PHONE: 'tel',
    URL: 'url',
  };

  return (
    <input
      className={className}
      id={question.id}
      type={typeMap[question.questionType] || 'text'}
      value={value ?? ''}
      placeholder={question.placeholder || ''}
      onChange={(event) => onChange(question.questionType === 'NUMBER' || question.questionType === 'CURRENCY' ? event.target.value : event.target.value)}
    />
  );
}

export function JobApplicationFlow({ job, resumes, candidate }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [answerUploads, setAnswerUploads] = useState({});
  const [selectedResumeId, setSelectedResumeId] = useState(resumes[0]?.id || '');
  const [selectedResumeMeta, setSelectedResumeMeta] = useState(resumes[0] || null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState({});
  const [uploadMessage, setUploadMessage] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isPending, startTransition] = useTransition();
  const [submission, setSubmission] = useState(null);

  const questions = useMemo(
    () => [...(job.screeningQuestions || [])].sort((a, b) => a.displayOrder - b.displayOrder),
    [job.screeningQuestions],
  );

  function updateAnswer(questionId, value) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setErrors((current) => ({ ...current, [questionId]: undefined }));
  }

  async function uploadResume(file) {
    setUploadMessage('Uploading resume…');
    const formData = new FormData();
    formData.set('resume', file);
    const response = await fetch('/api/candidate/resumes/upload', { method: 'POST', body: formData });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || 'Unable to upload resume.');
    }
    setSelectedResumeId(payload.data.id);
    setSelectedResumeMeta(payload.data);
    setUploadMessage('Resume uploaded successfully.');
  }

  async function uploadAnswerFile(questionId, file) {
    const formData = new FormData();
    formData.set('file', file);
    const response = await fetch('/api/candidate/application-files/upload', { method: 'POST', body: formData });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || 'Unable to upload file.');
    }
    setAnswerUploads((current) => ({ ...current, [questionId]: payload.data }));
  }

  function validateLocalStep() {
    const nextErrors = {};
    if (step === 0 && !selectedResumeId) {
      nextErrors.resume = 'Select or upload a resume to continue.';
    }
    if (step === 1) {
      for (const question of questions) {
        const value = answers[question.id];
        const hasUpload = Boolean(answerUploads[question.id]?.id);
        if (question.required && !hasUpload && (value == null || value === '' || (Array.isArray(value) && !value.length))) {
          nextErrors[question.id] = 'This question is required.';
        }
      }
    }
    if (step === 3) {
      if (!consentAccepted) nextErrors.consent = 'Consent is required.';
      if (!privacyAccepted) nextErrors.privacy = 'Privacy acknowledgement is required.';
      if (!termsAccepted) nextErrors.terms = 'Terms acknowledgement is required.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function nextStep() {
    if (!validateLocalStep()) return;
    setStep((current) => Math.min(current + 1, 3));
  }

  function previousStep() {
    setStep((current) => Math.max(current - 1, 0));
  }

  async function submitApplication() {
    setSubmitError('');
    if (!validateLocalStep()) return;

    const payload = {
      jobId: job.id,
      resumeAssetId: selectedResumeId,
      answers: questions.map((question) => ({
        questionId: question.id,
        value: question.questionType === 'NUMBER' || question.questionType === 'CURRENCY'
          ? (answers[question.id] === '' || answers[question.id] == null ? null : Number(answers[question.id]))
          : answers[question.id],
        fileAssetId: answerUploads[question.id]?.id || null,
      })),
      consentAccepted: true,
      privacyAccepted: true,
      termsAccepted: true,
      source: {
        sourceType: 'CAREER_PAGE',
      },
    };

    startTransition(async () => {
      const validationResponse = await fetch('/api/candidate/applications/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, answers: payload.answers }),
      });
      const validationPayload = await validationResponse.json();
      if (!validationResponse.ok) {
        setSubmitError(validationPayload.message || 'Validation failed.');
        return;
      }

      const submitResponse = await fetch('/api/candidate/applications/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const submitPayload = await submitResponse.json();
      if (!submitResponse.ok) {
        setSubmitError(submitPayload.message || 'Unable to submit your application.');
        return;
      }

      setSubmission(submitPayload.data);
      setStep(4);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[32px] p-6">
        <ol className="flex flex-wrap items-center gap-3" aria-label="Application progress">
          {steps.map((label, index) => (
            <li key={label} className="flex items-center gap-3">
              <div aria-current={index === step ? 'step' : undefined} className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${index <= step ? 'bg-[var(--brand)] text-white' : 'bg-[var(--soft)] text-[var(--muted)]'}`}>
                {index + 1}
              </div>
              <span className={`text-sm ${index <= step ? 'text-[var(--text)]' : 'text-[var(--muted)]'}`}>{label}</span>
            </li>
          ))}
        </ol>
      </Card>

      {step === 0 ? (
        <Card className="rounded-[32px] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-[var(--brand)]">Step 1</p>
              <h2 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">Select Resume</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">Choose an existing resume or upload a fresh version for this application.</p>
            </div>
            <Badge tone="brand">{resumes.length} saved</Badge>
          </div>
          <div className="mt-6 grid gap-4">
            {resumes.map((resume) => (
              <button
                key={resume.id}
                type="button"
                onClick={() => {
                  setSelectedResumeId(resume.id);
                  setSelectedResumeMeta(resume);
                }}
                className={`rounded-[24px] border px-5 py-4 text-left ${selectedResumeId === resume.id ? 'border-[var(--brand)] bg-[var(--soft)]' : 'border-[var(--line)]'}`}
              >
                <p className="font-semibold">{resume.filename}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Uploaded {formatDate(resume.createdAt)}</p>
              </button>
            ))}
          </div>
          <div className="mt-6 rounded-[24px] border border-dashed border-[var(--line)] p-5">
            <label htmlFor="resume-upload" className="block text-sm font-semibold">Upload new resume</label>
            <input
              id="resume-upload"
              type="file"
              accept=".pdf,.doc,.docx"
              className="mt-3 w-full text-sm"
              aria-describedby={errors.resume ? 'resume-error' : undefined}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                uploadResume(file).catch((error) => setErrors((current) => ({ ...current, resume: error.message })));
              }}
            />
            {uploadMessage ? <p className="mt-2 text-sm text-[var(--muted)]">{uploadMessage}</p> : null}
            {selectedResumeMeta ? <p className="mt-2 text-sm text-[var(--muted)]">Selected: {selectedResumeMeta.filename}</p> : null}
            {errors.resume ? <p id="resume-error" className="mt-2 text-sm text-rose-600">{errors.resume}</p> : null}
          </div>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card className="rounded-[32px] p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-[var(--brand)]">Step 2</p>
          <h2 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">Screening Questions</h2>
          <div className="mt-6 space-y-5">
            {questions.length === 0 ? <p className="text-sm text-[var(--muted)]">No screening questions were added to this job.</p> : null}
            {questions.map((question) => (
              <div key={question.id} className="rounded-[24px] border border-[var(--line)] p-5">
                <label className="block text-sm font-semibold" htmlFor={question.id}>
                  {question.questionText} {question.required ? <span className="text-rose-600">*</span> : null}
                </label>
                {question.helpText ? <p id={`${question.id}-help`} className="mt-2 text-sm text-[var(--muted)]">{question.helpText}</p> : null}
                <div className="mt-4">
                  <QuestionField
                    question={question}
                    value={answers[question.id]}
                    onChange={(value) => updateAnswer(question.id, value)}
                    upload={answerUploads[question.id]}
                    uploadPending={isPending}
                    onUpload={(file) => {
                      uploadAnswerFile(question.id, file).catch((error) => setErrors((current) => ({ ...current, [question.id]: error.message })));
                    }}
                  />
                </div>
                {errors[question.id] ? <p id={`${question.id}-error`} className="mt-2 text-sm text-rose-600">{errors[question.id]}</p> : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="rounded-[32px] p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-[var(--brand)]">Step 3</p>
          <h2 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">Review Application</h2>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-[24px] border border-[var(--line)] p-5">
              <h3 className="font-semibold">Candidate Details</h3>
              <p className="mt-3 text-sm text-[var(--muted)]">{candidate.fullName}</p>
              <p className="text-sm text-[var(--muted)]">{candidate.email}</p>
              <p className="text-sm text-[var(--muted)]">{candidate.currentTitle || 'Candidate profile'}</p>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] p-5">
              <h3 className="font-semibold">Selected Resume</h3>
              <p className="mt-3 text-sm text-[var(--muted)]">{selectedResumeMeta?.filename || 'No resume selected'}</p>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            {questions.map((question) => (
              <div key={question.id} className="rounded-[24px] border border-[var(--line)] p-5">
                <p className="font-semibold">{questionKey(question)}</p>
                <p className="mt-2 text-sm text-[var(--muted)]">{normalizeReviewValue(question, answers[question.id], answerUploads) || 'Not provided'}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="rounded-[32px] p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-[var(--brand)]">Step 4</p>
          <h2 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">Consent and Submit</h2>
          <div className="mt-6 space-y-3">
            <label className="flex items-start gap-3 rounded-2xl border border-[var(--line)] px-4 py-4 text-sm">
              <input type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} />
              <span>I confirm that the information in this application is accurate.</span>
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-[var(--line)] px-4 py-4 text-sm">
              <input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} />
              <span>I acknowledge the privacy notice for this application.</span>
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-[var(--line)] px-4 py-4 text-sm">
              <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
              <span>I agree to the relevant hiring terms for this submission.</span>
            </label>
          </div>
          {errors.consent || errors.privacy || errors.terms ? <p className="mt-3 text-sm text-rose-600">{errors.consent || errors.privacy || errors.terms}</p> : null}
          {submitError ? <p className="mt-3 text-sm text-rose-600">{submitError}</p> : null}
        </Card>
      ) : null}

      {step === 4 && submission ? (
        <Card className="rounded-[32px] p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-[var(--brand)]">Success</p>
          <h2 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">Application Submitted</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-[var(--line)] p-5">
              <p className="text-sm text-[var(--muted)]">Reference</p>
              <p className="mt-2 font-semibold">{submission.publicReference}</p>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] p-5">
              <p className="text-sm text-[var(--muted)]">Submitted</p>
              <p className="mt-2 font-semibold">{formatDate(submission.submittedAt)}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => router.push('/candidate/applications')} className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Track application</button>
            <button type="button" onClick={() => router.push('/jobs')} className="rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold">Browse similar jobs</button>
          </div>
        </Card>
      ) : null}

      {step < 4 ? (
        <div className="flex flex-wrap justify-between gap-3">
          <button type="button" onClick={previousStep} disabled={step === 0 || isPending} className="rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold disabled:opacity-40">Back</button>
          {step < 3 ? (
            <button type="button" onClick={nextStep} disabled={isPending} className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white disabled:opacity-50">Continue</button>
          ) : (
            <button type="button" onClick={submitApplication} disabled={isPending} className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white disabled:opacity-50">
              {isPending ? 'Submitting…' : 'Submit application'}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
