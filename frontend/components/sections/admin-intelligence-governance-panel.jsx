import { Card } from '@/components/ui/card';

export function AdminIntelligenceGovernancePanel({ governance, health }) {
  return (
    <div className="grid gap-6">
      <Card>
        <h2 className="font-[var(--font-display)] text-2xl font-semibold">Provider health</h2>
        <div className="mt-4 grid gap-3 text-sm">
          <p><span className="font-semibold">Provider:</span> {health?.provider || governance?.providerHealth?.provider || 'DISABLED'}</p>
          <p><span className="font-semibold">Healthy:</span> {String(health?.healthy ?? governance?.providerHealth?.healthy ?? false)}</p>
          <p><span className="font-semibold">Reason:</span> {health?.reason || governance?.providerHealth?.reason || 'Available'}</p>
        </div>
      </Card>

      <Card>
        <h2 className="font-[var(--font-display)] text-2xl font-semibold">Recent intelligence executions</h2>
        <div className="mt-4 space-y-3">
          {(governance?.recentExecutions || []).map((item) => (
            <div key={item.id} className="rounded-2xl border border-[var(--line)] p-4 text-sm">
              <p className="font-semibold">{item.feature}</p>
              <p className="mt-1 text-[var(--muted)]">{item.promptKey} v{item.promptVersion}</p>
              <p className="mt-1 text-[var(--muted)]">Status: {item.status} • Provider: {item.provider} • Cache: {String(item.cacheHit)}</p>
            </div>
          ))}
          {!governance?.recentExecutions?.length ? <p className="text-sm text-[var(--muted)]">No intelligence executions have been recorded yet.</p> : null}
        </div>
      </Card>

      <Card>
        <h2 className="font-[var(--font-display)] text-2xl font-semibold">Prompt versions in use</h2>
        <div className="mt-4 space-y-3">
          {(governance?.promptDefinitions || []).map((item) => (
            <div key={item.key} className="rounded-2xl border border-[var(--line)] p-4 text-sm">
              <p className="font-semibold">{item.key}</p>
              <p className="mt-1 text-[var(--muted)]">Version {item.version} • {item.status}</p>
              <p className="mt-1 text-[var(--muted)]">{item.purpose}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
