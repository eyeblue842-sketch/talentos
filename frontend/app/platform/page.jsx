import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { platformNav } from '@/lib/navigation';
import { getPlatformOverview } from '@/lib/api';

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone || 'text-[var(--color-text)]'}`}>{value}</p>
    </div>
  );
}

function statusTone(status) {
  const s = String(status || '').toUpperCase();
  if (['PAID', 'ACTIVE', 'EXPIRING_SOON'].includes(s)) return 'text-emerald-600';
  if (['FAILED', 'PAYMENT_FAILED', 'SUSPENDED'].includes(s)) return 'text-rose-600';
  if (['PENDING', 'PENDING_PAYMENT'].includes(s)) return 'text-amber-600';
  return 'text-[var(--color-text)]';
}

export default async function PlatformDashboardPage() {
  let data = null;
  let error = '';
  try {
    data = await getPlatformOverview();
  } catch (caught) {
    error = caught.message;
  }

  return (
    <WorkspaceShell brand="Careeriz Platform" items={platformNav}>
      <PageHeader
        eyebrow="Platform"
        title="Operator dashboard"
        description="Global view across every organisation on Careeriz — plans, payments, and anything needing attention."
        breadcrumb={[{ label: 'Platform' }, { label: 'Dashboard' }]}
      />

      {error ? (
        <Card><p className="text-sm text-[var(--color-text-secondary)]">{error}</p></Card>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Organisations" value={data.organisations.total} />
            <Stat label="Paid plans" value={data.organisations.paid} tone="text-emerald-600" />
            <Stat label="Free plans" value={data.organisations.free} />
            <Stat label="Registered users" value={data.users.total} />
            <Stat label="Payments — successful" value={data.payments.successful} tone="text-emerald-600" />
            <Stat label="Payments — failed" value={data.payments.failed} tone="text-rose-600" />
            <Stat label="Payments — pending" value={data.payments.pending} tone="text-amber-600" />
            <Stat label="Needs review" value={data.payments.needsManualReview} tone={data.payments.needsManualReview ? 'text-rose-600' : undefined} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Revenue</h2>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-[var(--color-text-secondary)]">Collected</p><p className="text-lg font-semibold">{money(data.revenue.collected)}</p></div>
                <div><p className="text-[var(--color-text-secondary)]">Refunded</p><p className="text-lg font-semibold">{money(data.revenue.refunded)}</p></div>
                <div><p className="text-[var(--color-text-secondary)]">Net</p><p className="text-lg font-semibold text-emerald-600">{money(data.revenue.net)}</p></div>
              </div>
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{data.revenue.mrrNote}</p>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Subscriptions by status</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.keys(data.subscriptions.byStatus || {}).length === 0
                  ? <p className="text-sm text-[var(--color-text-secondary)]">No subscriptions yet.</p>
                  : Object.entries(data.subscriptions.byStatus).map(([status, count]) => (
                    <span key={status} className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-3 py-1 text-sm">
                      <span className={`font-semibold ${statusTone(status)}`}>{status.replaceAll('_', ' ').toLowerCase()}</span>
                      <span className="text-[var(--color-text-secondary)]">{count}</span>
                    </span>
                  ))}
              </div>
            </Card>
          </div>

          {data.needsIntervention?.length ? (
            <Card className="border-rose-200 bg-rose-50/40">
              <h2 className="text-lg font-semibold text-rose-700">Needs intervention</h2>
              <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">Payments flagged for manual review — reconcile from the organisation page.</p>
              <div className="mt-3 divide-y divide-[var(--line)]">
                {data.needsIntervention.map((p) => (
                  <Link key={p.id} href={`/platform/organisations/${p.organisationId}`} className="flex items-center justify-between py-2 text-sm hover:text-[var(--brand)]">
                    <span className="font-medium">{p.organisationName || p.organisationId}</span>
                    <span className="text-[var(--color-text-secondary)]">{p.productCode} · {money(p.amount)} · <span className={statusTone(p.status)}>{p.status.toLowerCase()}</span></span>
                  </Link>
                ))}
              </div>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Recent organisations</h2>
              <div className="mt-3 divide-y divide-[var(--line)]">
                {data.recentOrganisations.length === 0 ? <p className="text-sm text-[var(--color-text-secondary)]">None yet.</p> : null}
                {data.recentOrganisations.map((org) => (
                  <Link key={org.id} href={`/platform/organisations/${org.id}`} className="flex items-center justify-between py-2 text-sm hover:text-[var(--brand)]">
                    <span className="font-medium">{org.name}</span>
                    <span className="text-[var(--color-text-secondary)]">{org.createdAt ? new Date(org.createdAt).toLocaleDateString() : ''}</span>
                  </Link>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Recent payments</h2>
              <div className="mt-3 divide-y divide-[var(--line)]">
                {data.recentPayments.length === 0 ? <p className="text-sm text-[var(--color-text-secondary)]">None yet.</p> : null}
                {data.recentPayments.map((p) => (
                  <Link key={p.id} href={`/platform/organisations/${p.organisationId}`} className="flex items-center justify-between py-2 text-sm hover:text-[var(--brand)]">
                    <span className="font-medium">{p.organisationName || p.organisationId}</span>
                    <span className="text-[var(--color-text-secondary)]">{money(p.amount)} · <span className={statusTone(p.status)}>{p.status.toLowerCase()}</span></span>
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </WorkspaceShell>
  );
}
