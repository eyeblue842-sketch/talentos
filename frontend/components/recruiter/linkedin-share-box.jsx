"use client";

import { useCallback, useEffect, useState } from 'react';
import { Linkedin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';

const STATUS_LABEL = {
  QUEUED: 'Queued',
  PUBLISHING: 'Publishing…',
  RETRYING: 'Retrying',
  PUBLISHED: 'Published',
  FAILED: 'Failed',
  NEEDS_ACTION: 'Action needed',
  CANCELLED: 'Cancelled',
};

// LinkedIn sharing for a published job. Posts are queued server-side (never
// inline), so this panel shows the durable state: queued / published / failed,
// with a clear reason and a manual retry. A LinkedIn problem never affects the
// Careeriz job itself.
export function LinkedInShareBox({ jobId }) {
  const { push } = useToast();
  const [info, setInfo] = useState(null);
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/social/linkedin/jobs/${jobId}/status`);
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        setInfo(body.data);
        setDestination((current) => current || body.data?.connection?.destinations?.[0]?.urn || '');
      }
    } catch { /* leave info null → loading state */ }
  }, [jobId]);

  // Initial fetch; load() sets state only after the awaited request resolves.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // Poll while something is in flight so the recruiter sees it complete.
  const inFlight = info?.posts?.some((post) => ['QUEUED', 'PUBLISHING', 'RETRYING'].includes(post.status));
  useEffect(() => {
    if (!inFlight) return undefined;
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, [inFlight, load]);

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

  async function share() {
    setBusy(true);
    try {
      const response = await fetch(`/api/social/linkedin/jobs/${jobId}/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorUrn: destination || undefined }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) throw new Error(body?.message || 'Could not share on LinkedIn.');
      push({ tone: 'success', title: body?.data?.posted ? 'Shared on LinkedIn' : 'Queued for LinkedIn', description: body?.data?.posted ? 'The job was shared.' : 'The post will be published shortly.' });
      await load();
    } catch (error) {
      push({ tone: 'error', title: 'LinkedIn share failed', description: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function retry(postId) {
    setBusy(true);
    try {
      const response = await fetch(`/api/social/linkedin/posts/${postId}/retry`, { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) throw new Error(body?.message || 'Retry failed.');
      push({ tone: 'success', title: 'Retry queued' });
      await load();
    } catch (error) {
      push({ tone: 'error', title: 'Cannot retry', description: error.message });
    } finally {
      setBusy(false);
    }
  }

  const connection = info?.connection;
  const notConfigured = connection && connection.configured === false;
  const latest = info?.posts?.[0];
  const published = latest?.status === 'PUBLISHED';

  return (
    <Card className="border-l-4 border-l-[#0a66c2]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]"><Linkedin size={18} className="text-[#0a66c2]" aria-hidden="true" /> Share on LinkedIn</h3>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Posts the role, location and the Careeriz apply link to your connected LinkedIn profile.
            {info?.shareOnLinkedIn ? ' You chose to share this job when publishing.' : ''}
          </p>
        </div>
      </div>

      {info?.ineligibleReason ? (
        <p className="mt-4 text-sm text-[var(--color-text-secondary)]">{info.ineligibleReason}</p>
      ) : null}

      {latest ? (
        <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--color-bg-muted)] px-3 py-3 text-sm" role="status">
          <p className="font-semibold text-[var(--color-text)]">
            {STATUS_LABEL[latest.status] || latest.status}
            {published && latest.postUrl ? <> · <a className="text-[#0a66c2] underline" href={latest.postUrl} target="_blank" rel="noreferrer">View post</a></> : null}
          </p>
          {latest.errorMessage ? <p className="mt-1 text-[var(--color-text-secondary)]">{latest.errorMessage}</p> : null}
          {latest.requiredAction ? <p className="mt-1 text-[var(--color-text-secondary)]">{latest.requiredAction}</p> : null}
          {latest.status === 'RETRYING' && latest.nextAttemptAt ? <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Next attempt: {new Date(latest.nextAttemptAt).toLocaleString()}</p> : null}
          {['FAILED', 'NEEDS_ACTION', 'CANCELLED'].includes(latest.status) ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {connection?.needsReconnect || ['AUTH_EXPIRED', 'PERMISSION_DENIED', 'NOT_CONNECTED'].includes(latest.errorCategory)
                ? <Button type="button" variant="outline" onClick={connect} loading={busy}>Reconnect LinkedIn</Button> : null}
              <Button type="button" onClick={() => retry(latest.id)} loading={busy}>Retry</Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {notConfigured ? (
        <p className="mt-4 rounded-[var(--radius-md)] bg-[var(--color-bg-muted)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">LinkedIn isn&apos;t set up on this workspace yet. An admin must add the LinkedIn app credentials.</p>
      ) : connection?.connected ? (
        !latest || !['PUBLISHED', 'QUEUED', 'PUBLISHING', 'RETRYING'].includes(latest.status) ? (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            {connection.destinations?.length > 1 ? (
              <Select label="Post as" value={destination} onChange={(e) => setDestination(e.target.value)}>
                {connection.destinations.map((d) => <option key={d.urn} value={d.urn}>{d.name}</option>)}
              </Select>
            ) : null}
            {!latest && !info?.ineligibleReason ? <Button type="button" onClick={share} loading={busy}>Share on LinkedIn</Button> : null}
            <span className="text-xs text-[var(--color-text-secondary)]">Connected as {connection.connectedName}</span>
          </div>
        ) : null
      ) : connection ? (
        <div className="mt-4">
          <Button type="button" onClick={connect} loading={busy}>{connection.needsReconnect ? 'Reconnect LinkedIn' : 'Connect LinkedIn'}</Button>
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            {info?.shareOnLinkedIn
              ? 'You chose to share this job. Once connected, it will be posted automatically (jobs published in the last 7 days).'
              : 'Connect once — Careeriz stores the connection securely so you won’t be asked again.'}
          </p>
        </div>
      ) : null}
    </Card>
  );
}
