import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { adminNav } from '@/lib/navigation';
import { getAdminFeatureFlags } from '@/lib/api';
import { saveAdminFeatureFlagAction } from '../actions';

export default async function AdminFeatureFlagsPage() {
  let flags = [];
  let error = '';
  try {
    flags = await getAdminFeatureFlags();
  } catch (caught) {
    error = caught.message;
  }

  return (
    <WorkspaceShell brand="Enterprise Admin" items={adminNav}>
      <PageHeader eyebrow="Feature flags" title="Manage organization feature flags" description="Enable or disable feature flags per organization without adding billing or external entitlement logic." breadcrumb={[{ label: 'Admin' }, { label: 'Feature Flags' }]} />
      {error ? <Card><p className="text-sm text-[var(--muted)]">{error}</p></Card> : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Current flags</h2>
          <div className="mt-5 space-y-3">
            {flags.map((flag) => (
              <div key={flag.id} className="rounded-2xl border border-[var(--line)] p-4 text-sm">
                <p className="font-semibold">{flag.key}</p>
                <p className="mt-1 text-[var(--muted)]">{flag.enabled ? 'Enabled' : 'Disabled'}{flag.description ? ` | ${flag.description}` : ''}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold">Create or update flag</h2>
          <form action={saveAdminFeatureFlagAction} className="mt-5 grid gap-3 text-sm">
            <input name="id" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Existing flag ID (optional)" />
            <input name="key" className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Flag key" />
            <textarea name="description" className="min-h-24 rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Description" />
            <label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked /> Enabled</label>
            <button type="submit" className="rounded-full bg-[var(--brand)] px-5 py-3 font-semibold text-white">Save feature flag</button>
          </form>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
