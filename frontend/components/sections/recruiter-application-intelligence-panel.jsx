"use client";

import { useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message || 'Request failed.');
  }
  return body.data;
}

export function RecruiterApplicationIntelligencePanel({ applicationId, candidateId, jobId, initialResume, initialMatch, initialInterview }) {
  const [resume, setResume] = useState(initialResume);
  const [match, setMatch] = useState(initialMatch);
  const [interview, setInterview] = useState(initialInterview);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  function sendFeedback(executionId, useful) {
    startTransition(async () => {
      try {
        await postJson('/api/intelligence/feedback', {
          executionId,
          useful,
          rating: useful ? 4 : 2,
        });
        setMessage(useful ? 'Feedback recorded: marked useful.' : 'Feedback recorded: marked not useful.');
      } catch (error) {
        setMessage(error.message);
      }
    });
  }

  function regenerateResume() {
    startTransition(async () => {
      try {
        setResume(await postJson('/api/intelligence/resume', { candidateId, forceRegenerate: true }));
      } catch (error) {
        setMessage(error.message);
      }
    });
  }

  function regenerateMatch() {
    startTransition(async () => {
      try {
        setMatch(await postJson('/api/intelligence/match', { candidateId, jobId, forceRegenerate: true }));
      } catch (error) {
        setMessage(error.message);
      }
    });
  }

  function generateInterview(mode) {
    startTransition(async () => {
      try {
        setInterview(await postJson('/api/intelligence/interview', { applicationId, mode, forceRegenerate: true }));
      } catch (error) {
        setMessage(error.message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold">Candidate intelligence</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">AI-generated suggestion. Review before use. These outputs never change ATS stages automatically.</p>
          </div>
          {pending ? <Badge variant="neutral">Working</Badge> : null}
        </div>

        {message ? <p className="mt-4 text-sm text-[var(--muted)]">{message}</p> : null}

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-[var(--line)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">Resume summary</h3>
              <Button type="button" size="sm" variant="outline" onClick={regenerateResume}>Regenerate</Button>
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">{resume?.aiSummary?.professionalSummary || resume?.deterministic?.professionalSummary || 'No summary available.'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(resume?.aiSkillExtraction?.normalizedSkills || resume?.deterministic?.skillClusters || []).slice(0, 8).map((skill) => (
                <Badge key={skill} variant="neutral">{skill}</Badge>
              ))}
            </div>
            {resume?.executionId ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => sendFeedback(resume.executionId, true)}>Useful</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => sendFeedback(resume.executionId, false)}>Not useful</Button>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-[var(--line)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">Match breakdown</h3>
              <Button type="button" size="sm" variant="outline" onClick={regenerateMatch}>Regenerate</Button>
            </div>
            <p className="mt-3 text-3xl font-semibold">{match?.deterministic?.overallScore ?? '--'}%</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{match?.explanation || 'Deterministic explanation unavailable.'}</p>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
              <p>Required skills: {match?.deterministic?.subscores?.requiredSkillScore ?? '--'}%</p>
              <p>Preferred skills: {match?.deterministic?.subscores?.preferredSkillScore ?? '--'}%</p>
              <p>Experience: {match?.deterministic?.subscores?.experienceScore ?? '--'}%</p>
              <p>Location: {match?.deterministic?.subscores?.locationScore ?? '--'}%</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(match?.deterministic?.matchedCriteria || []).slice(0, 6).map((item) => <Badge key={item} variant="brand">{item}</Badge>)}
              {(match?.deterministic?.missingRequiredCriteria || []).slice(0, 4).map((item) => <Badge key={item} variant="neutral">{item}</Badge>)}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--line)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Interview assistance</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">Generated questions and rubrics require interviewer review.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => generateInterview('QUESTION_SET')}>Generate Questions</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => generateInterview('RUBRIC')}>Generate Rubric</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => generateInterview('NOTES_SUMMARY')}>Summarize Notes</Button>
            </div>
          </div>

          {interview?.assisted?.questions?.length ? (
            <div className="mt-4 space-y-3">
              {interview.assisted.questions.slice(0, 5).map((item) => (
                <div key={item.question} className="rounded-2xl bg-[var(--soft)] p-3 text-sm">
                  <p className="font-semibold">{item.question}</p>
                  <p className="mt-1 text-[var(--muted)]">{item.rationale}</p>
                </div>
              ))}
            </div>
          ) : null}

          {interview?.assisted?.criteria?.length ? (
            <div className="mt-4 space-y-3">
              {interview.assisted.criteria.slice(0, 5).map((item) => (
                <div key={item.label} className="rounded-2xl bg-[var(--soft)] p-3 text-sm">
                  <p className="font-semibold">{item.label}</p>
                  <p className="mt-1 text-[var(--muted)]">{item.evidenceToLookFor}</p>
                </div>
              ))}
            </div>
          ) : null}

          {interview?.assisted?.summary ? <p className="mt-4 text-sm text-[var(--muted)]">{interview.assisted.summary}</p> : null}
        </div>
      </Card>
    </div>
  );
}
