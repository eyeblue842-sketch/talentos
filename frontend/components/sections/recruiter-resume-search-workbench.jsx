"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { BriefcaseBusiness, Download, Mail, Save, ShieldCheck, Tag, UserRoundCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { PaginationNav } from '@/components/sections/pagination-nav';
import { getInitials } from '@/lib/utils';
import { decorateResumePreview } from '@/lib/recruiter-resume-search';

const RESULT_HEIGHT = 252;

function ToolbarAction({ icon: Icon, label, onClick, disabled = false, variant = 'outline' }) {
  return (
    <Button type="button" variant={variant} size="sm" disabled={disabled} onClick={onClick}>
      <Icon size={15} aria-hidden="true" />
      {label}
    </Button>
  );
}

function ResultCard({ candidate, selected, previewSelected, onToggleSelect, onSelectPreview, onAction }) {
  return (
    <Card className={`min-h-[236px] transition ${previewSelected ? 'border-[var(--color-primary)] shadow-[var(--shadow-lg)]' : ''}`}>
      <div className="flex items-start gap-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(candidate.id)}
          className="mt-1 h-4 w-4 rounded border-[var(--color-border-strong)] accent-[var(--color-primary)]"
          aria-label={`Select ${candidate.fullName}`}
        />
        <button type="button" onClick={() => onSelectPreview(candidate.id)} className="flex min-w-0 flex-1 items-start gap-4 text-left">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]">
            {getInitials(candidate.fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-[var(--color-text)]">{candidate.fullName}</h3>
                <p className="mt-1 truncate text-sm text-[var(--color-text-secondary)]">{candidate.title}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="brand">Match {candidate.matchScore}%</Badge>
                <Badge variant="neutral">Resume {candidate.resumeScore}</Badge>
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)] md:grid-cols-2">
              <p>{candidate.totalExperienceLabel} · {candidate.currentCompany || 'Current company not shared'}</p>
              <p>{candidate.location || 'Location not shared'} · {candidate.noticePeriod}</p>
              <p>Salary {candidate.salaryLabel}</p>
              <p>{candidate.updatedLabel}</p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(candidate.skills || []).slice(0, 6).map((skill) => (
                <span key={skill} className="rounded-full bg-[var(--color-bg-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                  {skill}
                </span>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="neutral">{candidate.globalHiringStatus}</Badge>
              <Badge variant="neutral">{candidate.atsStatusLabel}</Badge>
              {candidate.organisationTags?.map((tag) => <Badge key={tag} variant="brand">{tag}</Badge>)}
            </div>
          </div>
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button as="a" href={`/recruiter/database/${candidate.id}`} variant="outline" size="sm">
          View Profile
        </Button>
        <ToolbarAction icon={UserRoundCheck} label="Shortlist" onClick={() => onAction('shortlist', [candidate.id])} />
        <ToolbarAction icon={BriefcaseBusiness} label="Add to ATS" onClick={() => onAction('addToAts', [candidate.id])} />
        <ToolbarAction icon={Mail} label="Email" onClick={() => onAction('email', [candidate.id])} />
        <ToolbarAction icon={Tag} label="Tag" onClick={() => onAction('tag', [candidate.id])} />
      </div>
    </Card>
  );
}

function PreviewPanel({
  preview,
  previewLoading,
  statusMessage,
  talentPools,
  selectedPoolId,
  setSelectedPoolId,
  onSaveToPool,
  resumeIntelligence,
  matchIntelligence,
  selectedJob,
}) {
  if (!preview) {
    return (
      <Card className="sticky top-24">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Candidate Preview</h2>
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">Select a candidate result to inspect experience, ATS status, notes, and privacy-controlled contact details.</p>
      </Card>
    );
  }

  return (
    <div className="sticky top-24 space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-info)]">Overview</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{preview.fullName}</h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{preview.title}</p>
          </div>
          {previewLoading ? <Badge variant="info">Loading</Badge> : <Badge variant="brand">{preview.matchScore}% match</Badge>}
        </div>

        <div className="mt-4 rounded-[20px] border border-[var(--color-border)] bg-[var(--color-bg-page)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Resume Summary</p>
          <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">
            {resumeIntelligence?.aiSummary?.professionalSummary || resumeIntelligence?.deterministic?.professionalSummary || preview.aiSummary}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Badge variant="success">{preview.globalHiringStatus}</Badge>
          <Badge variant="neutral">Resume {preview.resumeScore}</Badge>
          <Badge variant="neutral">{preview.noticePeriod}</Badge>
        </div>

        {statusMessage ? (
          <p className="mt-4 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            {statusMessage}
          </p>
        ) : null}
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-[var(--color-text)]">Match Breakdown</h3>
        {selectedJob ? (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-[var(--color-text-secondary)]">Linked to {selectedJob.title}</p>
            <p className="text-3xl font-semibold text-[var(--color-text)]">{matchIntelligence?.deterministic?.overallScore ?? preview.matchScore}%</p>
            <p className="text-[var(--color-text-secondary)]">{matchIntelligence?.explanation || 'Deterministic job match is unavailable for this preview.'}</p>
            <div className="grid gap-2 md:grid-cols-2">
              <p>Required skills: {matchIntelligence?.deterministic?.subscores?.requiredSkillScore ?? '--'}%</p>
              <p>Experience: {matchIntelligence?.deterministic?.subscores?.experienceScore ?? '--'}%</p>
              <p>Location: {matchIntelligence?.deterministic?.subscores?.locationScore ?? '--'}%</p>
              <p>Work mode: {matchIntelligence?.deterministic?.subscores?.workModeScore ?? '--'}%</p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">Select a job requirement to generate a candidate-job match breakdown.</p>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-[var(--color-text)]">Activity</h3>
        <div className="mt-4 grid gap-3">
          {preview.activity.map((item) => (
            <div key={item.id} className="rounded-[16px] border border-[var(--color-border)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{item.label}</p>
              <p className="mt-1 text-sm text-[var(--color-text)]">{item.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-[var(--color-text)]">ATS</h3>
        <div className="mt-4 space-y-3">
          {preview.atsPipeline.map((stage) => (
            <div key={stage.label} className={`rounded-[16px] border px-4 py-3 text-sm ${stage.current ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : stage.active ? 'border-[var(--color-border-strong)] bg-white text-[var(--color-text)]' : 'border-[var(--color-border)] bg-[var(--color-bg-muted)] text-[var(--color-text-muted)]'}`}>
              {stage.label}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-[var(--color-text)]">Notes</h3>
        {preview.organisationNotes?.length ? (
          <div className="mt-4 space-y-3">
            {preview.organisationNotes.map((note) => (
              <div key={note.id} className="rounded-[16px] border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                {note.content}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">No recruiter notes for this organisation.</p>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-[var(--color-text)]">Talent Pools</h3>
        <div className="mt-4 flex gap-2">
          <select value={selectedPoolId} onChange={(event) => setSelectedPoolId(event.target.value)} className="min-h-11 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3.5 py-2.5 text-sm text-[var(--color-text)] shadow-[var(--shadow-sm)]">
            <option value="">Select talent pool</option>
            {talentPools.map((pool) => (
              <option key={pool.id} value={pool.id}>{pool.name}</option>
            ))}
          </select>
          <Button type="button" onClick={onSaveToPool} disabled={!selectedPoolId}>
            <Save size={16} aria-hidden="true" />
            Save
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(preview.talentPools || []).map((pool) => <Badge key={pool} variant="neutral">{pool}</Badge>)}
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-[var(--color-text)]">Contact Information</h3>
        {preview.showContactInfo ? (
          <div className="mt-4 rounded-[16px] border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            <p className="font-semibold text-[var(--color-text)]">{preview.contactEmail}</p>
            <p className="mt-1">Visible because this recruiter already has organisation-authorized access to private candidate detail.</p>
          </div>
        ) : (
          <div className="mt-4 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} aria-hidden="true" className="text-[var(--color-primary)]" />
              Permission-based contact information
            </div>
            <p className="mt-2">Direct contact details remain hidden until organisation access rules allow them.</p>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-[var(--color-text)]">Experience</h3>
        <div className="mt-4 space-y-3">
          {preview.experienceTimeline.map((item) => (
            <div key={item.id} className="rounded-[16px] border border-[var(--color-border)] px-4 py-3">
              <p className="font-semibold text-[var(--color-text)]">{item.title}</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.company}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{item.summary}</p>
            </div>
          ))}
        </div>
        {preview.resumeUrl ? (
          <Button as="a" href={preview.resumeUrl} variant="outline" className="mt-4 w-full">
            <Download size={16} aria-hidden="true" />
            Download Resume
          </Button>
        ) : null}
      </Card>
    </div>
  );
}

async function postResumeSearchAction(action, payload) {
  const response = await fetch('/api/recruiter/resume-search/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message || 'Unable to complete recruiter action.');
  }
  return body.data;
}

export function RecruiterResumeSearchWorkbench({
  candidates,
  preview,
  meta,
  savedCandidates,
  queryParams,
  jobs = [],
  talentPools = [],
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [previewState, setPreviewState] = useState(preview);
  const [previewId, setPreviewId] = useState(preview?.id || candidates[0]?.id || null);
  const [selectedPoolId, setSelectedPoolId] = useState(talentPools[0]?.id || '');
  const [statusMessage, setStatusMessage] = useState('');
  const [resumeIntelligence, setResumeIntelligence] = useState(null);
  const [matchIntelligence, setMatchIntelligence] = useState(null);
  const [previewPending, startPreviewTransition] = useTransition();
  const [actionPending, startActionTransition] = useTransition();
  const scrollRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);

  const requirementJobId = queryParams.jobId || '';
  const selectedJob = useMemo(() => jobs.find((job) => job.id === requirementJobId) || null, [jobs, requirementJobId]);
  const selectedJobId = selectedJob?.id || null;

  const visibleCount = 4;
  const startIndex = Math.max(0, Math.floor(scrollTop / RESULT_HEIGHT) - 1);
  const endIndex = Math.min(candidates.length, startIndex + visibleCount);
  const visibleCandidates = candidates.slice(startIndex, endIndex);

  function toggleSelection(candidateId) {
    setSelectedIds((current) => (
      current.includes(candidateId)
        ? current.filter((id) => id !== candidateId)
        : [...current, candidateId]
    ));
  }

  function requireJobForAtsAction() {
    if (!requirementJobId) {
      setStatusMessage('Select a job requirement before shortlisting, emailing, or adding candidates to ATS.');
      return false;
    }
    return true;
  }

  function handleSelectPreview(candidateId) {
    setPreviewId(candidateId);
    startPreviewTransition(async () => {
      try {
        const previewResponse = await fetch(`/api/recruiter/candidate-preview/${candidateId}`, { cache: 'no-store' });
        const previewBody = await previewResponse.json();
        if (!previewResponse.ok) {
          throw new Error(previewBody.message || 'Unable to load candidate preview.');
        }
        setPreviewState(decorateResumePreview(previewBody.data));
      } catch (error) {
        setStatusMessage(error.message);
      }
    });
  }

  useEffect(() => {
    if (!previewState?.id) return;
    startPreviewTransition(async () => {
      try {
        const [resumeResponse, matchResponse] = await Promise.all([
          fetch('/api/intelligence/resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ candidateId: previewState.id }),
          }),
          selectedJobId
            ? fetch('/api/intelligence/match', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ candidateId: previewState.id, jobId: selectedJobId }),
              })
            : Promise.resolve(null),
        ]);

        const resumeBody = await resumeResponse.json();
        setResumeIntelligence(resumeResponse.ok ? resumeBody.data : null);
        if (matchResponse) {
          const matchBody = await matchResponse.json();
          setMatchIntelligence(matchResponse.ok ? matchBody.data : null);
        } else {
          setMatchIntelligence(null);
        }
      } catch {
        setResumeIntelligence(null);
        setMatchIntelligence(null);
      }
    });
  }, [previewState?.id, selectedJobId]);

  function summariseResult(label, result) {
    const successCount = result.items?.filter((item) => item.success).length || 0;
    const duplicateCount = result.items?.filter((item) => item.duplicate).length || 0;
    const failureCount = (result.items?.length || 0) - successCount - duplicateCount;
    const failures = (result.items || []).filter((item) => !item.success && !item.duplicate).slice(0, 3);
    const failureSummary = failures.length
      ? ` Failed: ${failures.map((item) => item.error || item.candidateId).join('; ')}.`
      : '';
    setStatusMessage(`${label}: ${successCount} succeeded, ${duplicateCount} duplicates prevented, ${failureCount} failed.${failureSummary}`);
  }

  function handleAction(action, candidateIds) {
    startActionTransition(async () => {
      try {
        if (['addToAts', 'shortlist', 'email'].includes(action) && !requireJobForAtsAction()) {
          return;
        }

        if (candidateIds.length > 1) {
          const confirmed = window.confirm(`Continue with ${candidateIds.length} selected candidates? Successful items will be preserved even if some items fail.`);
          if (!confirmed) {
            return;
          }
        }

        if (action === 'addToAts') {
          const result = await postResumeSearchAction('addToAts', {
            action: 'ADD_TO_ATS',
            candidateIds,
            jobId: requirementJobId,
            requisitionId: queryParams.requisitionId || null,
          });
          summariseResult('Add to ATS', result);
          return;
        }

        if (action === 'shortlist') {
          const result = await postResumeSearchAction('shortlist', {
            action: 'SHORTLIST',
            candidateIds,
            jobId: requirementJobId,
            requisitionId: queryParams.requisitionId || null,
          });
          summariseResult('Shortlist', result);
          return;
        }

        if (action === 'email') {
          const jobTitle = selectedJob?.title || 'this opportunity';
          const result = await postResumeSearchAction('email', {
            candidateIds,
            jobId: requirementJobId,
            subject: `Careeriz Hire outreach for ${jobTitle}`,
            body: `Hello,\n\nWe would like to discuss ${jobTitle} with you.\n\nRegards,\nCareeriz Hire`,
          });
          summariseResult('Email outreach', result);
          return;
        }

        if (action === 'tag') {
          const result = await postResumeSearchAction('tag', {
            candidateIds,
            tag: 'SHORTLISTED',
          });
          summariseResult('Tag update', result);
        }
      } catch (error) {
        setStatusMessage(error.message);
      }
    });
  }

  function handleBulkAction(action) {
    if (!selectedIds.length) {
      setStatusMessage('Select one or more candidates to run a bulk action.');
      return;
    }
    handleAction(action, selectedIds);
  }

  function handleSaveToPool() {
    if (!previewState?.id || !selectedPoolId) {
      setStatusMessage('Select a talent pool before saving a candidate.');
      return;
    }

    startActionTransition(async () => {
      try {
        const response = await fetch(`/api/recruiter/resume-search/talent-pools/${selectedPoolId}/candidates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidateIds: [previewState.id] }),
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.message || 'Unable to add candidate to talent pool.');
        }
        const poolName = talentPools.find((pool) => pool.id === selectedPoolId)?.name || 'selected talent pool';
        setStatusMessage(`${previewState.fullName} saved to ${poolName}.`);
      } catch (error) {
        setStatusMessage(error.message);
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]">
      <div className="min-w-0 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Profiles Found" value={meta?.total || candidates.length} helper={meta?.pageCount ? `${meta.pageCount} pages` : 'Single result page'} />
          <StatCard label="Selected" value={selectedIds.length} helper="Bulk actions enabled after selection" />
          <StatCard label="Saved Candidates" value={savedCandidates.length} helper="Organisation-scoped saved profiles" />
        </div>

        <Card>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text)]">Candidate Results</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {selectedJob ? `Requirement linked to ${selectedJob.title}.` : 'Select a requirement to connect shortlist and ATS actions directly to a hiring need.'}
              </p>
              {queryParams.requisitionId ? (
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">Requisition context is active for this search and ATS flow.</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <ToolbarAction icon={Mail} label="Bulk Email" onClick={() => handleBulkAction('email')} disabled={!selectedIds.length || actionPending} />
              <ToolbarAction icon={BriefcaseBusiness} label="Bulk Add to ATS" onClick={() => handleBulkAction('addToAts')} disabled={!selectedIds.length || actionPending} />
              <ToolbarAction icon={UserRoundCheck} label="Bulk Shortlist" onClick={() => handleBulkAction('shortlist')} disabled={!selectedIds.length || actionPending} />
              <ToolbarAction icon={Tag} label="Bulk Tag" onClick={() => handleBulkAction('tag')} disabled={!selectedIds.length || actionPending} variant="primary" />
            </div>
          </div>
          {statusMessage ? (
            <p className="mt-4 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
              {statusMessage}
            </p>
          ) : null}
        </Card>

        <div ref={scrollRef} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)} className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-page)] p-2 shadow-[var(--shadow-md)] xl:h-[calc(100vh-19rem)] xl:overflow-auto">
          {candidates.length === 0 ? (
            <Card>
              <h3 className="text-lg font-semibold text-[var(--color-text)]">No matching profiles</h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Refine skills, location, or designation filters to widen the recruiter search window.</p>
            </Card>
          ) : (
            <div style={{ height: candidates.length * RESULT_HEIGHT, position: 'relative' }}>
              <div style={{ transform: `translateY(${startIndex * RESULT_HEIGHT}px)` }} className="space-y-3">
                {visibleCandidates.map((candidate) => (
                  <ResultCard
                    key={candidate.id}
                    candidate={candidate}
                    selected={selectedIds.includes(candidate.id)}
                    previewSelected={candidate.id === previewId}
                    onToggleSelect={toggleSelection}
                    onSelectPreview={handleSelectPreview}
                    onAction={handleAction}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <PaginationNav basePath="/recruiter/database" params={queryParams} meta={meta} />
      </div>

      <div className="min-w-0 xl:max-h-[calc(100vh-9rem)] xl:overflow-auto xl:[resize:horizontal]">
        <PreviewPanel
          preview={previewState}
          previewLoading={previewPending}
          statusMessage={statusMessage}
          talentPools={talentPools}
          selectedPoolId={selectedPoolId}
          setSelectedPoolId={setSelectedPoolId}
          onSaveToPool={handleSaveToPool}
          resumeIntelligence={resumeIntelligence}
          matchIntelligence={matchIntelligence}
          selectedJob={selectedJob}
        />
      </div>
    </div>
  );
}
