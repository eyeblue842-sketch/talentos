"use client";

import { useEffect, useState } from 'react';
import { Linkedin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';

// Optional LinkedIn cross-post for a published job — posts ONLY the position,
// location and the Careeriz apply link (not the full description). The recruiter
// connects LinkedIn once; the encrypted token is stored server-side.
export function LinkedInShareBox({ jobId, jobTitle }) {
  const { push } = useToast();
  const [status, setStatus] = useState(null);
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [posted, setPosted] = useState(false);

  async function loadStatus() {
    try {
      const response = await fetch('/api/social/linkedin/status');
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        setStatus(body.data);
        setDestination(body.data?.destinations?.[0]?.urn || '');
      }
    } catch { /* leave status null → treated as not connected */ }
  }

  useEffect(() => { loadStatus(); }, []);

  async function connect() {
    setBusy(true);
    try {
      const response = await fetch('/api/social/linkedin/connect', { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.data?.authorizationUrl) throw new Error(body?.message || 'LinkedIn is not configured yet.');
      window.location.href = body.data.authorizationUrl;
    } catch (error) {
      push({ tone: 'error', title: 'Cannot connect LinkedIn', description: error.message });
      setBusy(false);
    }
  }

  async function post() {
    setBusy(true);
    try {
      const response = await fetch(`/api/social/linkedin/jobs/${jobId}/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorUrn: destination || undefined }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) throw new Error(body?.message || 'Could not post to LinkedIn.');
      setPosted(true);
      push({ tone: 'success', title: 'Posted to LinkedIn', description: 'The job was shared on LinkedIn.' });
    } catch (error) {
      push({ tone: 'error', title: 'LinkedIn post failed', description: error.message });
    } finally {
      setBusy(false);
    }
  }

  const notConfigured = status && status.configured === false;

  return (
    <Card className="border-l-4 border-l-[#0a66c2]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]"><Linkedin size={18} className="text-[#0a66c2]" aria-hidden="true" /> Share on LinkedIn</h3>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Optionally post this opening to LinkedIn — just the position, location, and the Careeriz apply link (not the full description).</p>
        </div>
      </div>

      {notConfigured ? (
        <p className="mt-4 rounded-[var(--radius-md)] bg-[var(--color-bg-muted)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">LinkedIn isn&apos;t set up on this workspace yet. An admin must add the LinkedIn app credentials.</p>
      ) : status?.connected ? (
        posted ? (
          <p className="mt-4 text-sm font-semibold text-[#0a66c2]">✓ Shared on LinkedIn.</p>
        ) : (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            {status.destinations?.length > 1 ? (
              <Select label="Post as" value={destination} onChange={(e) => setDestination(e.target.value)}>
                {status.destinations.map((d) => <option key={d.urn} value={d.urn}>{d.name}</option>)}
              </Select>
            ) : null}
            <Button type="button" onClick={post} loading={busy}>Post to LinkedIn</Button>
            <span className="text-xs text-[var(--color-text-secondary)]">Connected as {status.connectedName}</span>
          </div>
        )
      ) : (
        <div className="mt-4">
          <Button type="button" onClick={connect} loading={busy}>Connect LinkedIn</Button>
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Connect once — Careeriz securely stores the connection so you won&apos;t be asked again.</p>
        </div>
      )}
    </Card>
  );
}
