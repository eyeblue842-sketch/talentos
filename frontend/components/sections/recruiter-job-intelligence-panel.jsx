"use client";

import { useState, useTransition } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

async function postJobIntelligence(payload) {
  const response = await fetch('/api/intelligence/job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message || 'Unable to generate job intelligence.');
  }
  return body.data;
}

export function RecruiterJobIntelligencePanel({ jobId, initialDescription = '', initialSkills = [] }) {
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  function applySelected() {
    if (!result?.assisted && !result?.deterministic) return;
    const descriptionField = document.querySelector('[name="description"]');
    const skillsField = document.querySelector('[name="skillsRequired"]');
    const payload = result.assisted || result.deterministic;
    if (descriptionField && payload.summary) {
      descriptionField.value = payload.summary;
    }
    if (skillsField && payload.requiredSkills?.length) {
      skillsField.value = payload.requiredSkills.join(', ');
    }
    setMessage('Selected intelligence suggestions were applied to the edit form. Review and save manually.');
  }

  function generate(mode) {
    setMessage('');
    startTransition(async () => {
      try {
        setResult(await postJobIntelligence({
          jobId,
          mode,
          sourceDescription: initialDescription,
          forceRegenerate: true,
        }));
      } catch (error) {
        setMessage(error.message);
      }
    });
  }

  const payload = result?.assisted || result?.deterministic || null;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Job intelligence</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">AI-generated suggestion. Review before use. Nothing is auto-saved or auto-published.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => generate('DRAFT_DESCRIPTION')}><Sparkles size={16} />Draft</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => generate('IMPROVE_DESCRIPTION')}>Improve</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => generate('SUGGEST_SKILLS')}>Suggest Skills</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => generate('GENERATE_SCREENING_QUESTIONS')}>Screening</Button>
        </div>
      </div>

      {pending ? <p className="mt-4 text-sm text-[var(--muted)]">Generating recruiter-reviewable content…</p> : null}
      {message ? <p className="mt-4 text-sm text-[var(--muted)]">{message}</p> : null}

      {payload ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-[var(--line)] p-4">
            <h3 className="font-semibold">Suggested summary</h3>
            <p className="mt-3 text-sm text-[var(--muted)]">{payload.summary}</p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] p-4">
            <h3 className="font-semibold">Suggested skills</h3>
            <p className="mt-3 text-sm text-[var(--muted)]">{(payload.requiredSkills || initialSkills).join(', ') || 'No skills suggested.'}</p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] p-4">
            <h3 className="font-semibold">Warnings and missing fields</h3>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              {[...(payload.exclusionaryWordingWarnings || []), ...(payload.missingFields || [])].map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl border border-[var(--line)] p-4">
            <h3 className="font-semibold">Screening questions</h3>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              {(payload.screeningQuestions || []).slice(0, 6).map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
          <div className="xl:col-span-2">
            <Button type="button" onClick={applySelected}>Apply Selected Sections To Form</Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
