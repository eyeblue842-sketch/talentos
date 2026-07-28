"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CircleAlert,
  FileText,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton, TextSkeleton } from '@/components/ui/skeleton';
import { JobDescriptionActivityFeed } from '@/components/sections/job-description-activity-feed';
import { ApplyDraftDialog } from '@/components/sections/apply-draft-dialog';
import { JobDescriptionComparisonView } from '@/components/sections/job-description-comparison-view';
import { JobDescriptionEditor } from '@/components/sections/job-description-editor';
import { JobDescriptionHistoryPanel } from '@/components/sections/job-description-history-panel';
import { TemplateSelector } from '@/components/sections/template-selector';
import { JobDescriptionVersionTimeline } from '@/components/sections/job-description-version-timeline';
import { useToast } from '@/components/ui/toast';
import {
  buildDraftActivityLabel,
  buildDraftVersionLabel,
  buildJobDescriptionSupportReference,
  formatJobDescriptionActor,
  formatJobDescriptionDate,
  getJobDescriptionStatusMeta,
  getJobDraftStatusMeta,
  hasPreviousJobDescriptionResult,
  JOB_DESCRIPTION_TERMINAL_STATUSES,
  mapJobDescriptionError,
  parseJobDescriptionDraft,
  parseJobDescriptionDraftList,
  parseJobDescriptionHistory,
  parseJobDescriptionResult,
  parseJobDescriptionStatus,
  parseJobDescriptionTemplateList,
} from '@/lib/job-description-intelligence';

async function requestJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    const error = new Error(body?.message || 'Request failed.');
    error.statusCode = response.status;
    error.code = body?.code || null;
    throw error;
  }

  return body?.data;
}

function StatusBadge({ status }) {
  const meta = getJobDescriptionStatusMeta(status);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function DraftStatusBadge({ status }) {
  const meta = getJobDraftStatusMeta(status);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function SectionCard({ title, description, children, action = null }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text)]">{title}</h3>
          {description ? <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function BulletList({ items, emptyLabel }) {
  if (!items?.length) {
    return <p className="text-sm text-[var(--color-text-secondary)]">{emptyLabel}</p>;
  }

  return (
    <ul className="grid gap-2 text-sm leading-6 text-[var(--color-text-secondary)]">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
          {item}
        </li>
      ))}
    </ul>
  );
}

function joinLines(items = []) {
  return Array.isArray(items) ? items.join('\n') : '';
}

function splitLines(value) {
  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildEditorState(source = {}) {
  return {
    title: source.title || '',
    summary: source.summary || '',
    responsibilities: joinLines(source.responsibilities),
    requiredSkills: joinLines(source.requiredSkills),
    preferredSkills: joinLines(source.preferredSkills),
    screeningQuestions: joinLines(source.screeningQuestions),
    interviewFocus: joinLines(source.interviewFocus),
  };
}

function buildEditorStateFromDraft(draft) {
  if (!draft) return null;
  return buildEditorState({
    title: draft.title || draft.content?.title || '',
    summary: draft.content?.summary || '',
    responsibilities: draft.content?.responsibilities || [],
    requiredSkills: draft.content?.requiredSkills || [],
    preferredSkills: draft.content?.preferredSkills || [],
    screeningQuestions: draft.content?.screeningQuestions || [],
    interviewFocus: draft.content?.interviewFocus || [],
  });
}

function buildEditorStateFromResult(result, liveJob = null) {
  return buildEditorState({
    title: liveJob?.title || '',
    summary: result?.summary || liveJob?.description || '',
    responsibilities: result?.responsibilities?.length ? result.responsibilities : (liveJob?.responsibilities || []),
    requiredSkills: result?.requiredSkills?.length ? result.requiredSkills : (liveJob?.skillsRequired || []),
    preferredSkills: result?.preferredSkills || [],
    screeningQuestions: result?.screeningQuestions || [],
    interviewFocus: result?.interviewFocus || [],
  });
}

function buildEditorStateFromTemplate(template) {
  const version = template?.versions?.[0];
  if (!version) return null;
  return buildEditorState({
    title: version.title || version.content?.title || '',
    summary: version.content?.summary || '',
    responsibilities: version.content?.responsibilities || [],
    requiredSkills: version.content?.requiredSkills || [],
    preferredSkills: version.content?.preferredSkills || [],
    screeningQuestions: version.content?.screeningQuestions || [],
    interviewFocus: version.content?.interviewFocus || [],
  });
}

function mapEditorStateToDraftPayload(editorState) {
  return {
    title: editorState.title.trim() || '',
    content: {
      title: editorState.title.trim() || null,
      summary: editorState.summary.trim(),
      responsibilities: splitLines(editorState.responsibilities),
      requiredSkills: splitLines(editorState.requiredSkills),
      preferredSkills: splitLines(editorState.preferredSkills),
      screeningQuestions: splitLines(editorState.screeningQuestions),
      assumptions: [],
      exclusionaryWordingWarnings: [],
      missingFields: [],
      interviewFocus: splitLines(editorState.interviewFocus),
    },
  };
}

function validateEditorState(editorState) {
  const errors = {};

  if (!editorState.summary.trim()) {
    errors.summary = 'Job description is required before saving.';
  }

  return errors;
}

function findTemplateById(templates, templateId) {
  return templates.find((item) => item.id === templateId) || null;
}

function buildHistoryPreviewFromDraft(draft) {
  if (!draft) return null;
  return {
    id: draft.id,
    label: buildDraftVersionLabel(draft),
    title: draft.title || draft.content?.title || '',
    summary: draft.content?.summary || '',
    responsibilities: draft.content?.responsibilities || [],
    requiredSkills: draft.content?.requiredSkills || [],
    screeningQuestions: draft.content?.screeningQuestions || [],
    status: draft.status,
    timestamp: draft.updatedAt || draft.createdAt,
    actorUserId: draft.updatedByUserId || draft.createdByUserId || null,
  };
}

function buildCurrentDraftCompareState(editorState) {
  return {
    title: editorState?.title || '',
    summary: editorState?.summary || '',
    responsibilities: splitLines(editorState?.responsibilities),
    requiredSkills: splitLines(editorState?.requiredSkills),
    screeningQuestions: splitLines(editorState?.screeningQuestions),
  };
}

function buildHistoryEvents(history) {
  const draftEvents = (history?.drafts || []).flatMap((draft) => {
    const events = [{
      id: `draft-${draft.id}`,
      type: draft.previousVersionId ? 'EDITED' : (draft.sourceResultId ? 'GENERATED' : 'SAVED'),
      kind: 'Draft',
      label: buildDraftActivityLabel(draft),
      description: `${buildDraftVersionLabel(draft)} saved with status ${draft.status.toLowerCase()}.`,
      timestamp: draft.updatedAt || draft.createdAt,
      actorUserId: draft.updatedByUserId || draft.createdByUserId || null,
    }];

    if (draft.approvedAt) {
      events.push({
        id: `approved-${draft.id}`,
        type: 'EDITED',
        kind: 'Draft',
        label: 'Approved',
        description: `${buildDraftVersionLabel(draft)} was approved for apply workflow.`,
        timestamp: draft.approvedAt,
        actorUserId: draft.approvedByUserId,
      });
    }

    if (draft.appliedAt) {
      events.push({
        id: `applied-${draft.id}`,
        type: 'APPLIED',
        kind: 'Draft',
        label: 'Applied',
        description: `${buildDraftVersionLabel(draft)} was applied to the live job record.`,
        timestamp: draft.appliedAt,
        actorUserId: draft.appliedByUserId,
      });
    }

    if (draft.templateId) {
      events.push({
        id: `template-${draft.id}`,
        type: 'EDITED',
        kind: 'Template',
        label: 'Template selected',
        description: `${buildDraftVersionLabel(draft)} was created from a saved template.`,
        timestamp: draft.createdAt,
        actorUserId: draft.createdByUserId,
      });
    }

    return events;
  });

  const generationEvents = (history?.generations || []).map((generation, index) => ({
    id: `generation-${generation.resultId}`,
    type: generation.status === 'FAILED' ? 'FAILED' : index === 0 ? 'REGENERATED' : 'GENERATED',
    kind: 'Generation',
    label: generation.status === 'FAILED' ? 'Failed generation' : index === 0 ? 'Regenerated' : 'AI Generated',
    description: generation.status === 'FAILED'
      ? `An AI generation attempt failed for prompt version ${generation.promptVersion}.`
      : `AI generated a job description result using prompt version ${generation.promptVersion}.`,
    timestamp: generation.generatedAt,
    actorUserId: null,
  }));

  return [...draftEvents, ...generationEvents]
    .filter((event) => event.timestamp)
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));
}

function updateDraftCollection(currentDrafts, nextDraft) {
  const filtered = (currentDrafts || []).filter((item) => item.versionGroupId !== nextDraft.versionGroupId);
  return [nextDraft, ...filtered].sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
}

export function RecruiterAiJobDescriptionPanel({
  jobId,
  initialResult,
  initialStatus,
  initialDrafts = [],
  initialTemplates = [],
  initialHistory = null,
  initialLiveJob = null,
  featureEnabled,
  canRead,
  canGenerate,
}) {
  const router = useRouter();
  const { push } = useToast();

  const parsedInitialResult = useMemo(() => {
    if (!initialResult) return null;
    try {
      return parseJobDescriptionResult(initialResult);
    } catch {
      return null;
    }
  }, [initialResult]);

  const parsedInitialStatus = useMemo(() => {
    if (!initialStatus) return null;
    try {
      return parseJobDescriptionStatus(initialStatus);
    } catch {
      return null;
    }
  }, [initialStatus]);

  const parsedInitialDrafts = useMemo(() => {
    try {
      return parseJobDescriptionDraftList(initialDrafts || []);
    } catch {
      return [];
    }
  }, [initialDrafts]);

  const parsedInitialTemplates = useMemo(() => {
    try {
      return parseJobDescriptionTemplateList(initialTemplates || []);
    } catch {
      return [];
    }
  }, [initialTemplates]);

  const parsedInitialHistory = useMemo(() => {
    if (!initialHistory) return null;
    try {
      return parseJobDescriptionHistory(initialHistory);
    } catch {
      return null;
    }
  }, [initialHistory]);

  const [result, setResult] = useState(parsedInitialResult);
  const [status, setStatus] = useState(parsedInitialStatus || {
    jobId,
    kind: 'FULL_DESCRIPTION',
    status: parsedInitialResult?.execution?.status || 'PENDING',
    stale: Boolean(parsedInitialResult?.execution?.stale),
    generatedAt: parsedInitialResult?.execution?.generatedAt || null,
    latestExecutionId: parsedInitialResult?.execution?.executionId || null,
    latestResultId: parsedInitialResult?.execution?.resultId || null,
    sourceVersion: parsedInitialResult?.execution?.sourceVersion || 'unknown',
    promptVersion: parsedInitialResult?.execution?.promptVersion || 'unknown',
    resultVersion: parsedInitialResult?.execution?.resultVersion || 'unknown',
  });
  const [drafts, setDrafts] = useState(parsedInitialDrafts);
  const [templates, setTemplates] = useState(parsedInitialTemplates);
  const [history, setHistory] = useState(parsedInitialHistory);
  const [currentDraftId, setCurrentDraftId] = useState(parsedInitialDrafts[0]?.id || null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(parsedInitialDrafts[0]?.templateId || '');
  const [selectedHistoryDraftId, setSelectedHistoryDraftId] = useState(parsedInitialHistory?.drafts?.[0]?.id || parsedInitialDrafts[0]?.id || null);
  const initialEditorSeed = parsedInitialDrafts[0]
    ? buildEditorStateFromDraft(parsedInitialDrafts[0])
    : buildEditorStateFromResult(parsedInitialResult, initialLiveJob);
  const [editorState, setEditorState] = useState(initialEditorSeed);
  const [savedEditorState, setSavedEditorState] = useState(initialEditorSeed);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(!parsedInitialResult && !parsedInitialStatus && canRead && featureEnabled);
  const [draftLoading, setDraftLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState((parsedInitialStatus?.status || parsedInitialResult?.execution?.status) === 'PENDING');
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [requestPending, setRequestPending] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [applyPending, setApplyPending] = useState(false);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const pollStartedAtRef = useRef(null);
  const requestInFlightRef = useRef(false);

  const currentDraft = useMemo(
    () => drafts.find((item) => item.id === currentDraftId) || null,
    [currentDraftId, drafts],
  );
  const selectedTemplate = useMemo(
    () => findTemplateById(templates, selectedTemplateId),
    [selectedTemplateId, templates],
  );
  const selectedHistoryDraft = useMemo(
    () => history?.drafts?.find((item) => item.id === selectedHistoryDraftId) || null,
    [history, selectedHistoryDraftId],
  );
  const previewVersion = useMemo(() => buildHistoryPreviewFromDraft(selectedHistoryDraft), [selectedHistoryDraft]);
  const historyEvents = useMemo(() => buildHistoryEvents(history), [history]);
  const statusMeta = getJobDescriptionStatusMeta(status?.status || result?.execution?.status);
  const hasPreviousResult = hasPreviousJobDescriptionResult(result);
  const supportReference = buildJobDescriptionSupportReference(result);
  const hasRenderableContent = Boolean(
    result?.summary
    || result?.responsibilities?.length
    || result?.requiredSkills?.length
    || result?.preferredSkills?.length
    || result?.screeningQuestions?.length
  );
  const isDirty = JSON.stringify(editorState) !== JSON.stringify(savedEditorState);
  const currentDraftStatus = currentDraft ? currentDraft.status : null;

  async function refreshFullResult() {
    const payload = await requestJson(`/api/intelligence/jobs/${jobId}`);
    const parsed = parseJobDescriptionResult(payload);
    setResult(parsed);
    setStatus((current) => ({
      ...current,
      status: parsed.execution.status,
      stale: parsed.execution.stale,
      generatedAt: parsed.execution.generatedAt,
      latestExecutionId: parsed.execution.executionId,
      latestResultId: parsed.execution.resultId,
      sourceVersion: parsed.execution.sourceVersion,
      promptVersion: parsed.execution.promptVersion,
      resultVersion: parsed.execution.resultVersion,
    }));
    setError('');
    return parsed;
  }

  async function refreshStatus() {
    const payload = await requestJson(`/api/intelligence/jobs/${jobId}/status`);
    const parsed = parseJobDescriptionStatus(payload);
    setStatus(parsed);
    return parsed;
  }

  async function refreshDrafts() {
    const payload = await requestJson(`/api/intelligence/jobs/${jobId}/drafts`);
    const parsed = parseJobDescriptionDraftList(payload);
    setDrafts(parsed);
    return parsed;
  }

  async function refreshHistory() {
    const payload = await requestJson(`/api/intelligence/jobs/${jobId}/history`);
    const parsed = parseJobDescriptionHistory(payload);
    setHistory(parsed);
    return parsed;
  }

  async function loadDraftDetail(draftId) {
    const payload = await requestJson(`/api/intelligence/job-description-drafts/${draftId}`);
    const parsed = parseJobDescriptionDraft(payload);
    setDrafts((current) => updateDraftCollection(current, parsed));
    setHistory((current) => {
      if (!current) return current;
      return {
        ...current,
        drafts: updateDraftCollection(current.drafts, parsed),
      };
    });
    return parsed;
  }

  function replaceEditorState(nextState) {
    setEditorState(nextState);
    setSavedEditorState(nextState);
    setErrors({});
  }

  useEffect(() => {
    if (!featureEnabled || !canRead || parsedInitialResult || parsedInitialStatus) return undefined;
    let cancelled = false;

    setLoading(true);
    requestJson(`/api/intelligence/jobs/${jobId}`)
      .then((payload) => {
        if (cancelled) return;
        const parsed = parseJobDescriptionResult(payload);
        setResult(parsed);
        setStatus({
          jobId,
          kind: parsed.kind,
          status: parsed.execution.status,
          stale: parsed.execution.stale,
          generatedAt: parsed.execution.generatedAt,
          latestExecutionId: parsed.execution.executionId,
          latestResultId: parsed.execution.resultId,
          sourceVersion: parsed.execution.sourceVersion,
          promptVersion: parsed.execution.promptVersion,
          resultVersion: parsed.execution.resultVersion,
        });
        if (!parsedInitialDrafts.length) {
          const nextEditorState = buildEditorStateFromResult(parsed, initialLiveJob);
          setEditorState(nextEditorState);
          setSavedEditorState(nextEditorState);
        }
      })
      .catch((caught) => {
        if (!cancelled) setError(mapJobDescriptionError(caught));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, featureEnabled, initialLiveJob, jobId, parsedInitialDrafts.length, parsedInitialResult, parsedInitialStatus]);

  useEffect(() => {
    if (!featureEnabled || !canRead || parsedInitialDrafts.length) return undefined;
    let cancelled = false;

    requestJson(`/api/intelligence/jobs/${jobId}/drafts`)
      .then((payload) => {
        if (cancelled) return;
        const parsed = parseJobDescriptionDraftList(payload);
        setDrafts(parsed);
        if (parsed[0]) {
          setCurrentDraftId(parsed[0].id);
          setSelectedTemplateId(parsed[0].templateId || '');
          setSelectedHistoryDraftId(parsed[0].id);
          const nextState = buildEditorStateFromDraft(parsed[0]);
          replaceEditorState(nextState);
        }
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [canRead, featureEnabled, jobId, parsedInitialDrafts.length]);

  useEffect(() => {
    if (!featureEnabled || !canRead || parsedInitialTemplates.length) return undefined;
    let cancelled = false;

    requestJson('/api/intelligence/job-description-templates')
      .then((payload) => {
        if (!cancelled) {
          setTemplates(parseJobDescriptionTemplateList(payload));
        }
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [canRead, featureEnabled, parsedInitialTemplates.length]);

  useEffect(() => {
    if (!featureEnabled || !canRead || parsedInitialHistory) return undefined;
    let cancelled = false;

    requestJson(`/api/intelligence/jobs/${jobId}/history`)
      .then((payload) => {
        if (cancelled) return;
        const parsed = parseJobDescriptionHistory(payload);
        setHistory(parsed);
        if (!selectedHistoryDraftId && parsed.drafts[0]) {
          setSelectedHistoryDraftId(parsed.drafts[0].id);
        }
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [canRead, featureEnabled, jobId, parsedInitialHistory, selectedHistoryDraftId]);

  useEffect(() => {
    if (!polling) return undefined;

    if (!pollStartedAtRef.current) {
      pollStartedAtRef.current = Date.now();
    }

    let cancelled = false;
    let timer = null;

    async function pollOnce() {
      if (cancelled || requestInFlightRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) {
        timer = window.setTimeout(pollOnce, 8000);
        return;
      }

      if (Date.now() - pollStartedAtRef.current > 120000) {
        setPolling(false);
        setPollTimedOut(true);
        return;
      }

      requestInFlightRef.current = true;
      try {
        const nextStatus = await refreshStatus();
        if (JOB_DESCRIPTION_TERMINAL_STATUSES.has(nextStatus.status)) {
          setPolling(false);
          const nextResult = await refreshFullResult().catch(() => null);
          await refreshHistory().catch(() => null);
          if (nextResult && !currentDraftId && !isDirty) {
            const nextEditorState = buildEditorStateFromResult(nextResult, initialLiveJob);
            replaceEditorState(nextEditorState);
          }
          return;
        }
      } catch (caught) {
        setError(mapJobDescriptionError(caught));
      } finally {
        requestInFlightRef.current = false;
      }

      if (!cancelled) {
        timer = window.setTimeout(pollOnce, 4000);
      }
    }

    timer = window.setTimeout(pollOnce, 4000);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [currentDraftId, initialLiveJob, isDirty, polling]);

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  async function handleRegenerate() {
    setRequestPending(true);
    try {
      const payload = await requestJson(`/api/intelligence/jobs/${jobId}/regenerate`, {
        method: 'POST',
        body: JSON.stringify({ kind: 'FULL_DESCRIPTION', forceRegenerate: true }),
      });

      setStatus((current) => ({
        ...current,
        status: payload.status || 'PENDING',
      }));
      setPollTimedOut(false);
      pollStartedAtRef.current = Date.now();
      setPolling(true);
      push({
        tone: 'success',
        title: hasPreviousResult ? 'Job description regeneration queued' : 'Job description generation queued',
        description: 'The AI job description task is running in the background.',
      });
    } catch (caught) {
      push({
        tone: 'error',
        title: hasPreviousResult ? 'Regeneration failed' : 'Generation failed',
        description: mapJobDescriptionError(caught),
      });
    } finally {
      setRequestPending(false);
    }
  }

  async function handleManualRefresh() {
    setHistoryLoading(true);
    try {
      await Promise.all([
        refreshStatus(),
        refreshFullResult(),
        refreshDrafts().catch(() => null),
        refreshHistory().catch(() => null),
      ]);
      push({
        tone: 'success',
        title: 'Job description refreshed',
        description: 'The latest AI job description workspace data was loaded.',
      });
    } catch (caught) {
      push({
        tone: 'error',
        title: 'Refresh failed',
        description: mapJobDescriptionError(caught),
      });
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleFieldChange(field, nextValue) {
    setEditorState((current) => ({ ...current, [field]: nextValue }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function handleLoadTemplate() {
    if (!selectedTemplate) return;
    if (isDirty) {
      push({
        tone: 'error',
        title: 'Unsaved changes',
        description: 'Save or discard current edits before loading a template into the draft editor.',
      });
      return;
    }

    const nextState = buildEditorStateFromTemplate(selectedTemplate);
    if (!nextState) return;
    replaceEditorState(nextState);
    push({
      tone: 'success',
      title: 'Template loaded',
      description: 'The selected template has been loaded into the draft editor.',
    });
  }

  async function handleSelectDraft(draftId) {
    if (!draftId || draftId === currentDraftId) return;
    if (isDirty) {
      push({
        tone: 'error',
        title: 'Unsaved changes',
        description: 'Save or discard current edits before switching drafts.',
      });
      return;
    }

    setDraftLoading(true);
    try {
      const draft = await loadDraftDetail(draftId);
      setCurrentDraftId(draft.id);
      setSelectedTemplateId(draft.templateId || '');
      setSelectedHistoryDraftId(draft.id);
      replaceEditorState(buildEditorStateFromDraft(draft));
    } catch (caught) {
      push({
        tone: 'error',
        title: 'Draft load failed',
        description: mapJobDescriptionError(caught),
      });
    } finally {
      setDraftLoading(false);
    }
  }

  async function handleSaveDraft() {
    const nextErrors = validateEditorState(editorState);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      push({
        tone: 'error',
        title: 'Validation failed',
        description: 'Fix the highlighted draft fields before saving.',
      });
      return;
    }

    setSavePending(true);
    try {
      const payload = mapEditorStateToDraftPayload(editorState);
      let response;

      if (currentDraftId) {
        response = await requestJson(`/api/intelligence/job-description-drafts/${currentDraftId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: payload.title,
            content: payload.content,
          }),
        });
      } else {
        response = await requestJson('/api/intelligence/job-description-drafts', {
          method: 'POST',
          body: JSON.stringify({
            jobId,
            title: payload.title,
            content: payload.content,
            sourceStateId: result?.execution?.stateId || '',
            sourceExecutionId: result?.execution?.executionId || '',
            sourceResultId: result?.execution?.resultId || '',
            templateId: selectedTemplate?.id || '',
            templateVersionId: selectedTemplate?.versions?.[0]?.id || '',
            approve: false,
          }),
        });
      }

      const parsedDraft = parseJobDescriptionDraft(response);
      setCurrentDraftId(parsedDraft.id);
      setSelectedHistoryDraftId(parsedDraft.id);
      setSelectedTemplateId(parsedDraft.templateId || selectedTemplateId);
      setDrafts((current) => updateDraftCollection(current, parsedDraft));
      setHistory((current) => {
        if (!current) {
          return {
            jobId,
            state: status || null,
            drafts: [parsedDraft],
            generations: [],
          };
        }
        return {
          ...current,
          drafts: updateDraftCollection(current.drafts, parsedDraft),
        };
      });
      replaceEditorState(buildEditorStateFromDraft(parsedDraft));
      push({
        tone: 'success',
        title: 'Draft saved',
        description: 'The job description draft was saved successfully.',
      });
    } catch (caught) {
      push({
        tone: 'error',
        title: 'Save failed',
        description: mapJobDescriptionError(caught),
      });
    } finally {
      setSavePending(false);
    }
  }

  async function handleApplyDraft() {
    if (isDirty) {
      push({
        tone: 'error',
        title: 'Unsaved changes',
        description: 'Save the draft before applying it to the live job.',
      });
      return;
    }
    if (!currentDraftId) {
      push({
        tone: 'error',
        title: 'Draft required',
        description: 'Save a draft before applying it to the live job.',
      });
      return;
    }

    setApplyPending(true);
    try {
      let activeDraft = currentDraft;
      if (activeDraft?.status === 'DRAFT') {
        const approved = await requestJson(`/api/intelligence/job-description-drafts/${currentDraftId}`, {
          method: 'PATCH',
          body: JSON.stringify({ approve: true }),
        });
        activeDraft = parseJobDescriptionDraft(approved);
        setCurrentDraftId(activeDraft.id);
        setSelectedHistoryDraftId(activeDraft.id);
        setDrafts((current) => updateDraftCollection(current, activeDraft));
        setHistory((current) => {
          if (!current) return current;
          return {
            ...current,
            drafts: updateDraftCollection(current.drafts, activeDraft),
          };
        });
      }

      const applied = await requestJson(`/api/intelligence/job-description-drafts/${activeDraft.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ applyTitle: true }),
      });

      const parsedDraft = parseJobDescriptionDraft(applied.draft);
      setCurrentDraftId(parsedDraft.id);
      setSelectedHistoryDraftId(parsedDraft.id);
      setDrafts((current) => updateDraftCollection(current, parsedDraft));
      setHistory((current) => {
        if (!current) return current;
        return {
          ...current,
          drafts: updateDraftCollection(current.drafts, parsedDraft),
        };
      });
      setApplyDialogOpen(false);
      push({
        tone: 'success',
        title: 'Draft applied',
        description: 'The live job description was updated from the selected draft.',
      });
      router.refresh();
    } catch (caught) {
      push({
        tone: 'error',
        title: 'Apply failed',
        description: mapJobDescriptionError(caught),
      });
    } finally {
      setApplyPending(false);
    }
  }

  if (!featureEnabled) {
    return null;
  }

  if (!canRead) {
    return (
      <Card>
        <EmptyState
          icon={ShieldCheck}
          title="AI job description unavailable"
          description="This user does not have permission to view AI job description generation for this job."
        />
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <Skeleton className="h-7 w-64" />
            <Skeleton className="mt-3 h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold text-[var(--color-text)]">AI Job Description</h2>
              <StatusBadge status={status?.status || result?.execution?.status} />
              <Badge tone={status?.stale ? 'warning' : 'neutral'}>
                {status?.stale ? 'Stale result' : 'Fresh result'}
              </Badge>
              {currentDraftStatus ? <DraftStatusBadge status={currentDraftStatus} /> : null}
              {isDirty ? <Badge tone="warning">Pending Changes</Badge> : null}
            </div>
            <p className="max-w-3xl text-sm text-[var(--color-text-secondary)]">{statusMeta.description}</p>
            <div className="flex flex-wrap gap-4 text-sm text-[var(--color-text-secondary)]">
              <span>Generated: {formatJobDescriptionDate(status?.generatedAt || result?.execution?.generatedAt)}</span>
              <span>Draft status: {currentDraftStatus || 'Not saved yet'}</span>
              {supportReference ? <span>{supportReference}</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={handleManualRefresh}>
              <RefreshCcw size={16} aria-hidden="true" />
              Refresh
            </Button>
            {canGenerate ? (
              <Button type="button" onClick={handleRegenerate} disabled={requestPending || polling}>
                <Sparkles size={16} aria-hidden="true" />
                {hasPreviousResult ? 'Regenerate' : 'Generate'}
              </Button>
            ) : null}
          </div>
        </div>

        {status?.stale ? (
          <div className="mt-5 rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            The current AI job description was generated before the latest job update. The previous result stays visible until regeneration completes.
          </div>
        ) : null}

        {polling && hasPreviousResult ? (
          <div className="mt-5 rounded-[var(--radius-lg)] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            A new AI job description run is in progress. The previous successful result stays visible until the refresh completes.
          </div>
        ) : null}

        {status?.status === 'FAILED' ? (
          <div className="mt-5 rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            The latest generation attempt did not complete successfully. Review the current result and retry when needed.
          </div>
        ) : null}

        {status?.status === 'DISABLED' ? (
          <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            AI-generated job descriptions are currently unavailable for this environment.
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {error}
          </div>
        ) : null}

        {pollTimedOut ? (
          <div className="mt-5 rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            AI job description generation is still processing. Use manual refresh to check again.
          </div>
        ) : null}
      </Card>

      {polling && !hasPreviousResult ? (
        <Card className="border-blue-200 bg-blue-50">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-white p-2 text-blue-700 shadow-[var(--shadow-sm)]">
              <RefreshCcw className="animate-spin" size={16} aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-950">Generating the first AI job description</h3>
              <p className="mt-1 text-sm text-blue-900">
                The job description is being prepared in the background. This page will update automatically when the result is ready.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {!hasRenderableContent && !polling ? (
        <Card>
          <EmptyState
            icon={WandSparkles}
            title="No AI job description yet"
            description={canGenerate
              ? 'Generate a recruiter-ready job description from the current job details.'
              : 'AI job description generation has not produced a result for this job yet.'}
          />
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <div className="space-y-6">
          <SectionCard
            title="Draft editor"
            description="Edit the current AI job description draft. The live job record changes only after Apply Draft."
            action={draftLoading ? <Badge tone="info">Loading draft</Badge> : null}
          >
            <div className="space-y-5">
              <TemplateSelector
                templates={templates}
                value={selectedTemplateId}
                onChange={setSelectedTemplateId}
                onLoadTemplate={handleLoadTemplate}
                disabled={!canGenerate || savePending || applyPending}
              />

              {drafts.length ? (
                <div className="flex flex-wrap gap-2">
                  {drafts.map((draft) => (
                    <button
                      key={draft.id}
                      type="button"
                      onClick={() => handleSelectDraft(draft.id)}
                      className={`rounded-[var(--radius-pill)] border px-3 py-2 text-left text-sm font-medium ${
                        draft.id === currentDraftId
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                          : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'
                      }`}
                    >
                      v{draft.version} {draft.status.toLowerCase()}
                    </button>
                  ))}
                </div>
              ) : null}

              <JobDescriptionEditor
                value={editorState}
                errors={errors}
                disabled={!canGenerate || savePending || applyPending}
                onFieldChange={handleFieldChange}
              />

              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                Qualifications and benefits continue to be managed in the live job form above. The current draft workflow persists the job description, responsibilities, skills, screening questions, and interview focus supported by the existing backend contract.
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => replaceEditorState(currentDraft ? buildEditorStateFromDraft(currentDraft) : buildEditorStateFromResult(result, initialLiveJob))}
                  disabled={!isDirty || savePending || applyPending}
                >
                  Reset changes
                </Button>
                {canGenerate ? (
                  <Button type="button" onClick={handleSaveDraft} loading={savePending}>
                    Save Draft
                  </Button>
                ) : null}
                {canGenerate ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setApplyDialogOpen(true)}
                    disabled={savePending || applyPending || isDirty || !currentDraftId}
                  >
                    Apply Draft
                  </Button>
                ) : null}
              </div>
            </div>
          </SectionCard>

          {hasRenderableContent ? (
            <SectionCard
              title="Generated AI content"
              description="Latest AI-generated job description output retained for comparison while you edit the draft."
            >
              <div className="space-y-5">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-text)]">Job Description</h4>
                  {result?.summary ? (
                    <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">{result.summary}</p>
                  ) : (
                    <TextSkeleton lines={4} />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-text)]">Responsibilities</h4>
                  <div className="mt-3">
                    <BulletList items={result?.responsibilities || []} emptyLabel="No responsibilities were generated for this job." />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-text)]">Screening Questions</h4>
                  <div className="mt-3">
                    <BulletList items={result?.screeningQuestions || []} emptyLabel="No screening questions are available." />
                  </div>
                </div>
              </div>
            </SectionCard>
          ) : null}

          <JobDescriptionHistoryPanel
            drafts={history?.drafts || drafts}
            selectedDraftId={selectedHistoryDraftId}
            onSelectDraft={(draftId) => setSelectedHistoryDraftId(draftId)}
            onCompareDraft={(draftId) => setSelectedHistoryDraftId(draftId)}
            loading={historyLoading}
          />

          {previewVersion ? (
            <SectionCard
              title="Version preview"
              description="Open any previous version in a read-only preview before you compare or edit further."
              action={<Badge tone="neutral">Read-only</Badge>}
            >
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--color-text)]">{previewVersion.label}</p>
                  <DraftStatusBadge status={previewVersion.status} />
                </div>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Last updated {formatJobDescriptionDate(previewVersion.timestamp)} by {formatJobDescriptionActor(previewVersion.actorUserId)}.
                </p>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text)]">Summary</p>
                  <p className="mt-2 rounded-[var(--radius-lg)] bg-[var(--color-bg-muted)] px-4 py-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {previewVersion.summary || 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text)]">Responsibilities</p>
                  <div className="mt-2">
                    <BulletList items={previewVersion.responsibilities} emptyLabel="No responsibilities saved in this version." />
                  </div>
                </div>
              </div>
            </SectionCard>
          ) : null}

          <JobDescriptionComparisonView
            current={buildCurrentDraftCompareState(editorState)}
            selected={previewVersion}
            currentLabel={currentDraft ? `${buildDraftVersionLabel(currentDraft)} current draft` : 'Current Draft'}
            selectedLabel={previewVersion?.label || 'Selected Version'}
          />
        </div>

        <div className="space-y-6">
          <SectionCard
            title="Draft status"
            description="Track the current editable draft before it is applied to the live job."
          >
            <div className="grid gap-3 text-sm text-[var(--color-text-secondary)]">
              <p>Current draft: <span className="font-semibold text-[var(--color-text)]">{currentDraft ? `v${currentDraft.version}` : 'Not saved yet'}</span></p>
              <p>Status: <span className="font-semibold text-[var(--color-text)]">{currentDraftStatus || 'Unsaved'}</span></p>
              <p>Unsaved changes: <span className="font-semibold text-[var(--color-text)]">{isDirty ? 'Yes' : 'No'}</span></p>
              <p>Template: <span className="font-semibold text-[var(--color-text)]">{selectedTemplate?.name || 'None selected'}</span></p>
            </div>
          </SectionCard>

          <SectionCard
            title="Template details"
            description="Use system or organization templates to seed a new job description draft."
          >
            {selectedTemplate ? (
              <div className="grid gap-3 text-sm text-[var(--color-text-secondary)]">
                <p>Name: <span className="font-semibold text-[var(--color-text)]">{selectedTemplate.name}</span></p>
                <p>Scope: <span className="font-semibold text-[var(--color-text)]">{selectedTemplate.scope === 'SYSTEM' ? 'System' : 'Organization'}</span></p>
                <p>Version: <span className="font-semibold text-[var(--color-text)]">v{selectedTemplate.versions?.[0]?.version || 1}</span></p>
                {selectedTemplate.description ? <p>{selectedTemplate.description}</p> : null}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">Select a template to load its active version into the draft editor.</p>
            )}
          </SectionCard>

          {hasRenderableContent ? (
            <>
              <SectionCard
                title="Required skills"
                description="Key skills extracted or inferred from the current AI result."
              >
                {result?.requiredSkills?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {result.requiredSkills.map((item) => <Badge key={item} tone="neutral">{item}</Badge>)}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--color-text-secondary)]">No required skills were generated.</p>
                )}
              </SectionCard>

              <SectionCard
                title="Preferred skills"
                description="Nice-to-have skills suggested by the current AI result."
              >
                {result?.preferredSkills?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {result.preferredSkills.map((item) => <Badge key={item} tone="neutral">{item}</Badge>)}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--color-text-secondary)]">No preferred skills were generated.</p>
                )}
              </SectionCard>
            </>
          ) : null}

          <SectionCard
            title="Generation details"
            description="Recruiter-safe metadata for the current AI job description result."
          >
            <div className="grid gap-3 text-sm text-[var(--color-text-secondary)]">
              <p>Status: <span className="font-semibold text-[var(--color-text)]">{statusMeta.label}</span></p>
              <p>Generated: {formatJobDescriptionDate(result?.execution?.generatedAt)}</p>
              <p>Prompt version: {result?.execution?.promptVersion || 'Not available'}</p>
              <p>Source version: {result?.execution?.sourceVersion || 'Not available'}</p>
              <p>Cache: {result?.execution?.cacheHit ? 'Cached result' : 'Fresh generation'}</p>
            </div>
          </SectionCard>

          <SectionCard
            title="Review notes"
            description="Additional recruiter-safe guidance from the current AI result."
          >
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">Missing fields</p>
                <div className="mt-3">
                  <BulletList items={result?.missingFields || []} emptyLabel="No missing fields were flagged." />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">Interview focus</p>
                <div className="mt-3">
                  <BulletList items={result?.interviewFocus || []} emptyLabel="No interview focus areas were returned." />
                </div>
              </div>
            </div>
          </SectionCard>

          <JobDescriptionVersionTimeline events={historyEvents} />
          <JobDescriptionActivityFeed events={historyEvents.slice(0, 8)} />
        </div>
      </div>

      {!hasRenderableContent && polling ? (
        <Card>
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-[var(--color-bg-muted)] p-2 text-[var(--color-text-muted)]">
              <FileText size={16} aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--color-text)]">AI draft pending</h3>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                The first AI job description is still processing. Keep this page open or use manual refresh to check the status.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {status?.status === 'REVIEW_REQUIRED' && !hasRenderableContent ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="More job information is required"
            description="This job needs more structured details before a richer AI job description can be generated."
          />
        </Card>
      ) : null}

      {status?.status === 'FAILED' && !hasPreviousResult ? (
        <Card>
          <EmptyState
            icon={CircleAlert}
            title="AI job description failed"
            description="No successful AI job description result is available yet. Review the job details and try again."
          />
        </Card>
      ) : null}

      <ApplyDraftDialog
        open={applyDialogOpen}
        onClose={() => setApplyDialogOpen(false)}
        onConfirm={handleApplyDraft}
        pending={applyPending}
      />
    </div>
  );
}
