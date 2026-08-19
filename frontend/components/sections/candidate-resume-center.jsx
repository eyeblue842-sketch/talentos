'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CandidateResumeSuggestionBanner } from '@/components/sections/candidate-resume-suggestion-banner';
import { formatCareerizDate } from '@/lib/date-format';
import {
  applyResumeParsedUpdatesAction,
  linkExternalResumeBuilderAction,
  updateResumeAssetStateAction,
} from '@/app/candidate/actions';

export function CandidateResumeCenter({ resumes, resumeBuilderState }) {
  const router = useRouter();
  const [uploadState, setUploadState] = useState({ status: 'idle', message: '' });
  const [isPending, startTransition] = useTransition();
  const [isResumeActionPending, startResumeActionTransition] = useTransition();
  const [pendingResumeAssetId, setPendingResumeAssetId] = useState(null);
  const uploadRef = useRef(null);
  const hasPendingResume = resumes.some((resume) => ['PENDING', 'PROCESSING'].includes(resume.parsingStatus));

  useEffect(() => {
    if (!hasPendingResume) return undefined;

    const interval = setInterval(() => {
      router.refresh();
    }, 5000);

    return () => clearInterval(interval);
  }, [hasPendingResume, router]);

  // Adjusting state during render (not in an effect): clear the tracked
  // pending resume as soon as the latest `resumes` prop shows it is no
  // longer PENDING/PROCESSING. See:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (pendingResumeAssetId) {
    const stillPending = resumes.some((resume) => resume.id === pendingResumeAssetId && ['PENDING', 'PROCESSING'].includes(resume.parsingStatus));
    if (!stillPending) {
      setPendingResumeAssetId(null);
    }
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.set('resume', file);
    setUploadState({ status: 'pending', message: 'Uploading resume...' });

    try {
      const response = await fetch('/api/candidate/resumes/upload', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to upload resume.');
      }
      setUploadState({ status: 'success', message: 'Resume uploaded successfully.' });
      router.refresh();
    } catch (error) {
      setUploadState({ status: 'error', message: error.message || 'Unable to upload resume.' });
    } finally {
      if (uploadRef.current) {
        uploadRef.current.value = '';
      }
    }
  }

  return (
    <div className="space-y-6">
      <CandidateResumeSuggestionBanner
        suggestions={{
          hasSuggestions: Boolean(resumes[0]?.parsedData?.suggestedUpdates && Object.keys(resumes[0].parsedData.suggestedUpdates).length),
          assetId: resumes[0]?.id || null,
          title: 'We found fresh details from your resume',
          description: 'Review the information we found and update your profile.',
          items: Object.entries(resumes[0]?.parsedData?.suggestedUpdates || {}).map(([field, suggestion]) => ({
            field,
            currentValue: suggestion?.currentValue ?? null,
            resumeValue: suggestion?.resumeValue ?? null,
            confidence: suggestion?.confidence ?? 0,
          })),
        }}
      />

      <Card className="rounded-[32px] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-[var(--brand)]">Resume management</p>
            <h2 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">Upload a resume, let Careeriz parse it, then review structured updates</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              Resume upload, parsing, profile enrichment, and candidate review stay connected here. Careeriz stores the file, runs parsing in the background worker, and helps you update profile sections safely.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex cursor-pointer items-center rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">
              Upload Resume
              <input ref={uploadRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleUpload} />
            </label>
            {resumeBuilderState.enabled && resumeBuilderState.links.create ? (
              <a
                href={resumeBuilderState.links.create}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold text-[var(--text)]"
              >
                Create Resume
              </a>
            ) : (
              <span className="rounded-2xl border border-dashed border-[var(--line)] px-5 py-3 font-semibold text-[var(--muted)]">
                Resume Builder unavailable
              </span>
            )}
          </div>
        </div>

        {uploadState.status !== 'idle' ? (
          <Alert
            className="mt-5"
            tone={uploadState.status === 'error' ? 'danger' : uploadState.status === 'success' ? 'success' : 'info'}
            title={uploadState.status === 'error' ? 'Upload failed' : uploadState.status === 'success' ? 'Resume uploaded' : 'Uploading'}
          >
            {uploadState.message}
          </Alert>
        ) : null}
      </Card>

      <Card className="rounded-[32px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">External Resume Builder</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Deep links are generated centrally from environment configuration. Candidate data is never sent in query parameters.
            </p>
          </div>
          <div className="rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-semibold text-[var(--brand)]">
            {resumeBuilderState.enabled ? 'Configured' : 'Disabled'}
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--line)] p-4 text-sm">
            <p className="font-semibold">Create Resume</p>
            <p className="mt-2 text-[var(--muted)]">Open the external builder to create a new resume.</p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] p-4 text-sm">
            <p className="font-semibold">Edit Resume</p>
            <p className="mt-2 text-[var(--muted)]">Resume editing stays outside Careeriz and can be linked back through external metadata.</p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] p-4 text-sm">
            <p className="font-semibold">Manage Resumes</p>
            <p className="mt-2 text-[var(--muted)]">Candidates can manage builder-side resume variants without exposing internal Careeriz routes.</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {resumeBuilderState.links.create ? <a href={resumeBuilderState.links.create} target="_blank" rel="noreferrer" className="rounded-2xl bg-[var(--brand)] px-4 py-3 font-semibold text-white">Open Create Flow</a> : null}
          {resumeBuilderState.links.edit ? <a href={resumeBuilderState.links.edit} target="_blank" rel="noreferrer" className="rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold text-[var(--text)]">Edit External Resume</a> : null}
          {resumeBuilderState.links.manage ? <a href={resumeBuilderState.links.manage} target="_blank" rel="noreferrer" className="rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold text-[var(--text)]">Manage in Resume Builder</a> : null}
        </div>
        {!resumeBuilderState.enabled ? (
          <p className="mt-4 text-sm text-[var(--muted)]">{resumeBuilderState.disabledReason}</p>
        ) : null}
      </Card>

      <div className="grid gap-6">
        {resumes.length ? resumes.map((resume) => (
          <Card key={resume.id} className="rounded-[28px] p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-[var(--font-display)] text-2xl font-semibold">{resume.filename}</h3>
                  {resume.isPrimary ? <span className="rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-semibold text-[var(--brand)]">Primary</span> : null}
                  <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">{resume.status}</span>
                  <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">{resume.parsingStatusLabel}</span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-[var(--muted)] md:grid-cols-2">
                  <p>MIME type: {resume.mimeType}</p>
                  <p>Size: {resume.sizeBytes} bytes</p>
                  <p>Created: {formatCareerizDate(resume.createdAt)}</p>
                  <p>Updated: {formatCareerizDate(resume.updatedAt)}</p>
                </div>
                {resume.parsedData?.summary ? (
                  <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
                    {resume.parsedData.summary}
                  </div>
                ) : null}
                {resume.parsingStatusMessage ? (
                  <p className="mt-3 text-sm text-[var(--muted)]">{resume.parsingStatusMessage}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <a href={resume.downloadUrl} className="rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold text-[var(--text)]">Download</a>
                {!resume.isPrimary ? (
                  <form action={updateResumeAssetStateAction}>
                    <input type="hidden" name="assetId" value={resume.id} />
                    <input type="hidden" name="actionType" value="SET_PRIMARY" />
                    <Button type="submit" variant="outline">Set Primary</Button>
                  </form>
                ) : null}
                {resume.status !== 'ARCHIVED' ? (
                  <form action={updateResumeAssetStateAction}>
                    <input type="hidden" name="assetId" value={resume.id} />
                    <input type="hidden" name="actionType" value="ARCHIVE" />
                    <Button type="submit" variant="outline">Archive</Button>
                  </form>
                ) : (
                  <form action={updateResumeAssetStateAction}>
                    <input type="hidden" name="assetId" value={resume.id} />
                    <input type="hidden" name="actionType" value="RESTORE" />
                    <Button type="submit" variant="outline">Restore</Button>
                  </form>
                )}
                <form
                  action={(formData) => {
                    const nextAssetId = String(formData.get('assetId') || '');
                    setPendingResumeAssetId(nextAssetId || null);
                    startResumeActionTransition(async () => {
                      await updateResumeAssetStateAction(formData);
                      router.refresh();
                    });
                  }}
                >
                  <input type="hidden" name="assetId" value={resume.id} />
                  <input type="hidden" name="actionType" value="RETRY_PARSE" />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={isResumeActionPending || ['PENDING', 'PROCESSING'].includes(resume.parsingStatus)}
                  >
                    {pendingResumeAssetId === resume.id || ['PENDING', 'PROCESSING'].includes(resume.parsingStatus) ? 'Parsing...' : 'Retry parsing'}
                  </Button>
                </form>
                <form action={updateResumeAssetStateAction}>
                  <input type="hidden" name="assetId" value={resume.id} />
                  <input type="hidden" name="actionType" value="DELETE" />
                  <Button type="submit" variant="outline">Delete</Button>
                </form>
              </div>
            </div>

            {resume.parsedData?.availableFields?.length ? (
              <div className="mt-5 rounded-2xl border border-[var(--line)] p-4">
                <p className="font-semibold">Apply parsed profile suggestions</p>
                <p className="mt-2 text-sm text-[var(--muted)]">Review resume-derived suggestions and apply only the fields you want to update.</p>
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  {resume.parsedData.suggestedUpdates?.currentTitle ? (
                    <label className="flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2">
                      <input type="checkbox" name={`resume-${resume.id}-title`} defaultChecked readOnly />
                      <span>Title: {resume.parsedData.suggestedUpdates.currentTitle.resumeValue}</span>
                    </label>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <form action={applyResumeParsedUpdatesAction}>
                    <input type="hidden" name="assetId" value={resume.id} />
                    <input type="hidden" name="acceptAll" value="true" />
                    <Button type="submit">Accept All Suggestions</Button>
                  </form>
                  <form action={applyResumeParsedUpdatesAction}>
                    <input type="hidden" name="assetId" value={resume.id} />
                    <input type="hidden" name="dismiss" value="true" />
                    {Object.keys(resume.parsedData.suggestedUpdates || {}).map((field) => (
                      <input key={field} type="hidden" name="fields" value={field} />
                    ))}
                    <Button type="submit" variant="outline">Dismiss</Button>
                  </form>
                </div>
              </div>
            ) : null}
          </Card>
        )) : (
          <Card className="rounded-[28px] p-10 text-center">
            <h3 className="font-[var(--font-display)] text-2xl font-semibold">No resumes uploaded yet</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">Upload a PDF or DOCX to use it for applications, parsing, and recruiter-visible metadata.</p>
          </Card>
        )}
      </div>

      {resumeBuilderState.enabled ? (
        <Card className="rounded-[28px] p-6">
          <h3 className="font-[var(--font-display)] text-2xl font-semibold">Link external resume metadata</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">Use this only when you want Careeriz to remember the external resume ID and edit URL for future handoff.</p>
          <form
            action={(formData) => {
              startTransition(async () => {
                await linkExternalResumeBuilderAction(formData);
                router.refresh();
              });
            }}
            className="mt-5 grid gap-4 md:grid-cols-3"
          >
            <input name="externalResumeId" placeholder="External resume ID" className="rounded-2xl border border-[var(--line)] px-4 py-3" />
            <input name="externalResumeUrl" placeholder="External resume URL" className="rounded-2xl border border-[var(--line)] px-4 py-3" />
            <input name="externalResumeVersion" placeholder="External version" className="rounded-2xl border border-[var(--line)] px-4 py-3" />
            <div className="md:col-span-3">
              <Button type="submit" disabled={isPending} loading={isPending}>
                {isPending ? 'Linking...' : 'Save External Resume Metadata'}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
