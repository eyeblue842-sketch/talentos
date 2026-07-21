'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  applyResumeParsedUpdatesAction,
  linkExternalResumeBuilderAction,
  updateResumeAssetStateAction,
} from '@/app/candidate/actions';

function formatDate(value) {
  if (!value) return 'Not available';
  return new Date(value).toLocaleString();
}

export function CandidateResumeCenter({ resumes, resumeBuilderState }) {
  const router = useRouter();
  const [uploadState, setUploadState] = useState({ status: 'idle', message: '' });
  const [isPending, startTransition] = useTransition();
  const uploadRef = useRef(null);

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
      <Card className="rounded-[32px] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-[var(--brand)]">Resume management</p>
            <h2 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">Upload, manage, and select application-ready resumes</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              Careeriz stores resume files and metadata only. Resume creation and editing live in the external Resume Builder product.
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
                  <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">{resume.parsingStatus}</span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-[var(--muted)] md:grid-cols-2">
                  <p>MIME type: {resume.mimeType}</p>
                  <p>Size: {resume.sizeBytes} bytes</p>
                  <p>Created: {formatDate(resume.createdAt)}</p>
                  <p>Updated: {formatDate(resume.updatedAt)}</p>
                </div>
                {resume.parsedData?.summary ? (
                  <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
                    {resume.parsedData.summary}
                  </div>
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
                <form action={updateResumeAssetStateAction}>
                  <input type="hidden" name="assetId" value={resume.id} />
                  <input type="hidden" name="actionType" value="RETRY_PARSE" />
                  <Button type="submit" variant="outline">Retry Parse</Button>
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
                <p className="mt-2 text-sm text-[var(--muted)]">Review the limited metadata-based suggestions and apply only the fields you want.</p>
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  {resume.parsedData.availableFields.includes('currentTitle') && resume.parsedData.suggestedUpdates?.currentTitle ? (
                    <label className="flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2">
                      <input type="checkbox" name={`resume-${resume.id}-title`} defaultChecked readOnly />
                      <span>Title: {resume.parsedData.suggestedUpdates.currentTitle}</span>
                    </label>
                  ) : null}
                  {resume.parsedData.availableFields.includes('skills') && Array.isArray(resume.parsedData.suggestedUpdates?.skills) ? (
                    <label className="flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2">
                      <input type="checkbox" name={`resume-${resume.id}-skills`} defaultChecked readOnly />
                      <span>Skills: {resume.parsedData.suggestedUpdates.skills.join(', ')}</span>
                    </label>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <form action={applyResumeParsedUpdatesAction}>
                    <input type="hidden" name="assetId" value={resume.id} />
                    <input type="hidden" name="acceptAll" value="true" />
                    <Button type="submit">Accept All Suggestions</Button>
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
