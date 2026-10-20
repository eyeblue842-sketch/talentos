'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api/platform/linkedin${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json?.success === false) throw new Error(json?.message || 'Request failed.');
  return json.data;
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone || 'text-[var(--color-text)]'}`}>{value ?? 0}</p>
    </div>
  );
}

const STATUS_TONE = {
  CONNECTED: 'text-emerald-600', PUBLISHED: 'text-emerald-600',
  EXPIRED: 'text-amber-600', RETRYING: 'text-amber-600', QUEUED: 'text-amber-600', PUBLISHING: 'text-amber-600', PENDING_AUTH: 'text-amber-600',
  REVOKED: 'text-rose-600', FAILED: 'text-rose-600', NEEDS_ACTION: 'text-rose-600', DISCONNECTED: 'text-[var(--color-text-secondary)]', CANCELLED: 'text-[var(--color-text-secondary)]',
};

function Status({ value }) {
  return <span className={`text-xs font-semibold ${STATUS_TONE[value] || ''}`}>{String(value || '').replace('_', ' ')}</span>;
}

const REASONS = {
  IDENTITY_MISMATCH: 'That LinkedIn login belongs to a different profile than this destination. Create a new destination for it.',
  DUPLICATE_PROFILE: 'That LinkedIn profile is already connected as another destination.',
  PERMISSION_DENIED: 'The "Share on LinkedIn" (w_member_social) permission was not granted.',
};

export function LinkedInConsole() {
  const { push } = useToast();
  const params = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [attribution, setAttribution] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [search, setSearch] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api(''));
      setAttribution(await api('/attribution'));
      setJobs(await api(`/jobs${search ? `?search=${encodeURIComponent(search)}` : ''}`));
      setError('');
    } catch (caught) {
      setError(caught.message);
    }
  }, [search]);

  // Initial fetch; load() sets state only after the awaited request resolves.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const result = params.get('linkedin');
    if (result === 'connected') push({ tone: 'success', title: 'LinkedIn profile connected' });
    if (result === 'error') push({ tone: 'error', title: 'LinkedIn connection failed', description: REASONS[params.get('reason')] || 'Authorization could not be completed.' });
  }, [params, push]);

  async function run(fn, success) {
    setBusy(true);
    try {
      const result = await fn();
      if (result?.authorizationUrl) { window.location.href = result.authorizationUrl; return; }
      if (success) push({ tone: 'success', title: success });
      await load();
    } catch (caught) {
      push({ tone: 'error', title: 'Action failed', description: caught.message });
    } finally {
      setBusy(false);
    }
  }

  if (error) return <Card><p className="text-sm text-[var(--color-text-secondary)]">{error}</p></Card>;
  if (!data) return <Card><p className="text-sm text-[var(--color-text-secondary)]">Loading…</p></Card>;

  const { readiness, settings, destinations, totals, recentPosts, auditLog, excludedJobs } = data;
  const anyReady = destinations.some((d) => d.enabled && d.canPublish);

  return (
    <div className="grid gap-6">
      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Readiness</h2>
        <ul className="mt-3 grid gap-1 text-sm text-[var(--color-text-secondary)]">
          <li>LinkedIn app credentials: <strong>{readiness.configured ? 'configured' : 'NOT configured (set LINKEDIN_CLIENT_ID / SECRET / OAUTH_REDIRECT_URI)'}</strong></li>
          <li>Server publishing switch (LINKEDIN_PUBLISHING_ENABLED): <strong>{readiness.publishingEnabled ? 'on' : 'OFF — posts are held until enabled'}</strong></li>
          <li>Verified against the live LinkedIn API: <strong>{readiness.verifiedAgainstLiveApi ? 'yes' : 'no — requires the "Share on LinkedIn" product on your LinkedIn app and a real authorization'}</strong></li>
          <li>API version header: {readiness.apiVersion}. Required products: {readiness.requiredProducts.join('; ')}.</li>
        </ul>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Eligible jobs" value={totals.eligibleJobs} />
        <Stat label="Queued / in progress" value={totals.queued} tone="text-amber-600" />
        <Stat label="Published" value={totals.published} tone="text-emerald-600" />
        <Stat label="Failed / action needed" value={totals.failed} tone={totals.failed ? 'text-rose-600' : undefined} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Automatic distribution</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">Independent of recruiter opt-in. Newly published, eligible jobs are queued to every enabled, connected profile below.</p>
          </div>
          <Button
            type="button"
            variant={settings.autoDistribute ? 'outline' : 'primary'}
            loading={busy}
            disabled={!settings.autoDistribute && (!readiness.publishingEnabled || !anyReady)}
            onClick={() => run(() => api('/settings', { method: 'PUT', body: { autoDistribute: !settings.autoDistribute } }), settings.autoDistribute ? 'Automatic distribution disabled' : 'Automatic distribution enabled')}
          >
            {settings.autoDistribute ? 'Disable' : 'Enable'}
          </Button>
        </div>
        {!settings.autoDistribute && (!readiness.publishingEnabled || !anyReady) ? (
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Enabling needs LINKEDIN_PUBLISHING_ENABLED=true and at least one connected, enabled profile.</p>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Personal LinkedIn profiles</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">Each profile must be authorized by its own owner signing in to LinkedIn. The setup e-mail is only a reference label — it never grants access.</p>
        <div className="mt-4 grid gap-3">
          {destinations.length ? destinations.map((d) => (
            <div key={d.id} className="rounded-xl border border-[var(--line)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-[var(--color-text)]">{d.label} {d.isPrimary ? <span className="ml-1 rounded bg-[var(--color-bg-muted)] px-1.5 py-0.5 text-xs">Primary</span> : null} <Status value={d.status} /></p>
                  <p className="text-[var(--color-text-secondary)]">Setup e-mail: {d.setupEmail || '—'}</p>
                  <p className="break-all text-[var(--color-text-secondary)]">Verified member: {d.memberUrn ? `${d.memberName || ''} (${d.memberUrn})` : 'not yet verified'}</p>
                  <p className="text-[var(--color-text-secondary)]">Publish permission: {d.canPublish ? 'granted' : 'not granted'} · Token expires: {d.accessTokenExpiresAt ? new Date(d.accessTokenExpiresAt).toLocaleDateString() : '—'}{d.hasRefreshToken ? ' · refreshable' : ''}</p>
                  {d.lastErrorMessage ? <p className="text-rose-600">{d.lastErrorMessage}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={busy} onClick={() => run(() => api(`/destinations/${d.id}/connect`, { method: 'POST' }))}>
                    {d.status === 'CONNECTED' ? 'Reconnect' : 'Connect'}
                  </Button>
                  <Button type="button" variant="outline" disabled={busy} onClick={() => run(() => api(`/destinations/${d.id}`, { method: 'PATCH', body: { enabled: !d.enabled } }), d.enabled ? 'Destination disabled' : 'Destination enabled')}>
                    {d.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  {d.status === 'CONNECTED' && !d.isPrimary ? (
                    <Button type="button" variant="outline" disabled={busy} onClick={() => run(() => api(`/destinations/${d.id}`, { method: 'PATCH', body: { isPrimary: true } }), 'Primary profile updated')}>Make primary</Button>
                  ) : null}
                  {d.status !== 'DISCONNECTED' && d.status !== 'PENDING_AUTH' ? (
                    <Button type="button" variant="outline" disabled={busy} onClick={() => run(() => api(`/destinations/${d.id}/disconnect`, { method: 'POST' }), 'Disconnected and token revoked')}>Disconnect</Button>
                  ) : null}
                </div>
              </div>
            </div>
          )) : <p className="text-sm text-[var(--color-text-secondary)]">No profiles yet.</p>}
        </div>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            run(async () => { await api('/destinations', { method: 'POST', body: { label: newLabel, setupEmail: newEmail || undefined } }); setNewLabel(''); setNewEmail(''); }, 'Profile added — now connect it');
          }}
        >
          <Input label="Label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Vinu — personal" required />
          <div>
            <Input label="Setup e-mail (reference)" list="li-setup-emails" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="optional" />
            <datalist id="li-setup-emails">{readiness.setupEmailSuggestions.map((email) => <option key={email} value={email} />)}</datalist>
          </div>
          <Button type="submit" loading={busy}>Add profile</Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Jobs</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">Exclude a job from platform distribution, or distribute an already-published job now.</p>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <Input label="Search open jobs" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        <div className="mt-3 grid gap-2">
          {jobs.map((job) => (
            <div key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-[var(--color-text)]">{job.title} <span className="text-[var(--color-text-secondary)]">· {job.company || '—'}</span></p>
                <p className="text-xs text-[var(--color-text-secondary)]">{job.excluded ? 'Excluded' : job.posts.length ? job.posts.map((p) => p.status).join(', ') : 'Not posted by platform'}</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={() => run(() => api(`/jobs/${job.id}/exclusion`, { method: 'PUT', body: { excluded: !job.excluded } }), job.excluded ? 'Job re-included' : 'Job excluded')}>
                  {job.excluded ? 'Include' : 'Exclude'}
                </Button>
                {!job.excluded && !job.posts.length ? (
                  <Button type="button" disabled={busy || !readiness.publishingEnabled || !anyReady} onClick={() => run(() => api(`/jobs/${job.id}/distribute`, { method: 'POST' }), 'Queued for platform profiles')}>Distribute now</Button>
                ) : null}
              </div>
            </div>
          ))}
          {!jobs.length ? <p className="text-sm text-[var(--color-text-secondary)]">No open jobs.</p> : null}
        </div>
        {excludedJobs.length ? <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Excluded: {excludedJobs.map((j) => j.title).join(', ')}</p> : null}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Recent publications</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-[var(--color-text-secondary)]"><tr><th className="py-2">Job</th><th>Profile</th><th>Status</th><th>Attempts</th><th>Detail</th><th /></tr></thead>
            <tbody>
              {recentPosts.map((post) => (
                <tr key={post.id} className="border-t border-[var(--line)] align-top">
                  <td className="py-2 pr-2">{post.job?.title}</td>
                  <td className="pr-2">{post.destinationLabel}</td>
                  <td className="pr-2"><Status value={post.status} /></td>
                  <td className="pr-2">{post.attemptCount}</td>
                  <td className="pr-2 text-xs text-[var(--color-text-secondary)]">
                    {post.postUrl ? <a className="text-[#0a66c2] underline" href={post.postUrl} target="_blank" rel="noreferrer">View post</a> : null}
                    {post.errorMessage ? <span>{post.errorMessage} {post.requiredAction || ''}</span> : null}
                  </td>
                  <td>
                    {['FAILED', 'NEEDS_ACTION', 'CANCELLED'].includes(post.status) ? (
                      <Button type="button" variant="outline" disabled={busy} onClick={() => run(() => api(`/posts/${post.id}/retry`, { method: 'POST' }), 'Retry queued')}>Retry</Button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!recentPosts.length ? <tr><td colSpan={6} className="py-3 text-[var(--color-text-secondary)]">Nothing published yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Candidate acquisition (measured, first-party)</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">{attribution?.note}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-[var(--color-text-secondary)]"><tr><th className="py-2">Job / post</th><th>Link visits</th><th>Reg. started</th><th>Registered</th><th>Resumes</th><th>Profiles</th><th>Applications</th><th>Visit→Apply</th></tr></thead>
            <tbody>
              {(attribution?.byPost || []).map((row) => (
                <tr key={row.postId} className="border-t border-[var(--line)]">
                  <td className="py-2 pr-2">{row.jobTitle} <span className="text-xs text-[var(--color-text-secondary)]">({row.destinationType.toLowerCase()})</span></td>
                  <td>{row.CLICK}</td><td>{row.REGISTRATION_START}</td><td>{row.REGISTRATION_COMPLETE}</td><td>{row.RESUME_UPLOAD}</td><td>{row.PROFILE_COMPLETE}</td><td>{row.APPLICATION}</td>
                  <td>{row.clickToApplicationRate == null ? '—' : `${row.clickToApplicationRate}%`}</td>
                </tr>
              ))}
              {!(attribution?.byPost || []).length ? <tr><td colSpan={8} className="py-3 text-[var(--color-text-secondary)]">No published posts to attribute yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Not available from LinkedIn&apos;s permitted API and therefore not shown: {(attribution?.unavailable || []).join(', ')}.</p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Audit log</h2>
        <ul className="mt-3 grid gap-1 text-xs text-[var(--color-text-secondary)]">
          {auditLog.map((entry) => <li key={entry.id}>{new Date(entry.createdAt).toLocaleString()} — {entry.action} ({entry.entityType})</li>)}
          {!auditLog.length ? <li>No activity yet.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
