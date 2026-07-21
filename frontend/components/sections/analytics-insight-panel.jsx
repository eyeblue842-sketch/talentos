"use client";

import { useState, useTransition } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function AnalyticsInsightPanel() {
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      try {
        const response = await fetch('/api/intelligence/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ periodDays: 30 }),
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.message || 'Unable to generate analytics insight.');
        }
        setResult(body.data);
        setMessage('');
      } catch (error) {
        setMessage(error.message);
      }
    });
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Analytics insight</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">AI-generated suggestion. Review before use. Narrative explanations only cite deterministic backend metrics.</p>
        </div>
        <Button type="button" onClick={generate} variant="outline">
          <Sparkles size={16} aria-hidden="true" />
          {pending ? 'Generating...' : 'Generate Insight'}
        </Button>
      </div>

      {message ? <p className="mt-4 text-sm text-[var(--muted)]">{message}</p> : null}
      {result?.insight ? (
        <div className="mt-5 space-y-4">
          <p className="text-sm text-[var(--muted)]">{result.insight.summary}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--line)] p-4">
              <h3 className="font-semibold">Findings</h3>
              <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                {(result.insight.findings || []).map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl border border-[var(--line)] p-4">
              <h3 className="font-semibold">Metric references</h3>
              <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                {(result.insight.metricReferences || []).map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          </div>
          {(result.insight.cautions || []).length ? (
            <div className="rounded-2xl border border-[var(--line)] p-4">
              <h3 className="font-semibold">Cautions</h3>
              <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                {result.insight.cautions.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
