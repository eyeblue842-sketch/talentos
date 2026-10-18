import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { platformNav } from '@/lib/navigation';
import { getPlatformOrganisations } from '@/lib/api';

function statusTone(status) {
  const s = String(status || '').toUpperCase();
  if (['PAID', 'ACTIVE', 'EXPIRING_SOON'].includes(s)) return 'text-emerald-600';
  if (['FAILED', 'PAYMENT_FAILED', 'SUSPENDED', 'EXPIRED'].includes(s)) return 'text-rose-600';
  if (['PENDING', 'PENDING_PAYMENT'].includes(s)) return 'text-amber-600';
  return 'text-[var(--color-text-secondary)]';
}

export default async function PlatformOrganisationsPage({ searchParams }) {
  const params = await searchParams;
  const search = typeof params?.search === 'string' ? params.search : '';
  const query = new URLSearchParams();
  if (search) query.set('search', search);

  let items = [];
  let meta = {};
  let error = '';
  try {
    const res = await getPlatformOrganisations(query.toString());
    items = res.items || [];
    meta = res.meta || {};
  } catch (caught) {
    error = caught.message;
  }

  return (
    <WorkspaceShell brand="Careeriz Platform" items={platformNav}>
      <PageHeader
        eyebrow="Platform"
        title="Organisations"
        description="Every organisation registered on Careeriz — plan, subscription and latest payment at a glance."
        breadcrumb={[{ label: 'Platform', href: '/platform' }, { label: 'Organisations' }]}
      />

      <Card>
        <form className="flex flex-wrap items-center gap-2" action="/platform/organisations" method="get">
          <input
            name="search"
            defaultValue={search}
            placeholder="Search by name or slug…"
            className="min-w-[240px] flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
          />
          <button className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white">Search</button>
          {search ? <Link href="/platform/organisations" className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-semibold">Clear</Link> : null}
        </form>
      </Card>

      {error ? (
        <Card><p className="text-sm text-[var(--color-text-secondary)]">{error}</p></Card>
      ) : (
        <Card className="overflow-x-auto">
          <p className="mb-3 text-sm text-[var(--color-text-secondary)]">{meta.total ?? items.length} organisation{(meta.total ?? items.length) === 1 ? '' : 's'}</p>
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
                <th className="py-2 pr-3">Organisation</th>
                <th className="py-2 pr-3">Owner</th>
                <th className="py-2 pr-3">Members</th>
                <th className="py-2 pr-3">Plan</th>
                <th className="py-2 pr-3">Subscription</th>
                <th className="py-2 pr-3">Latest payment</th>
                <th className="py-2 pr-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-[var(--color-text-secondary)]">No organisations found.</td></tr>
              ) : null}
              {items.map((org) => (
                <tr key={org.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface)]">
                  <td className="py-2 pr-3">
                    <Link href={`/platform/organisations/${org.id}`} className="font-semibold text-[var(--color-text)] hover:text-[var(--brand)] hover:underline">{org.name}</Link>
                    <p className="text-xs text-[var(--color-text-secondary)]">{org.slug}</p>
                  </td>
                  <td className="py-2 pr-3">{org.owner ? (org.owner.name || org.owner.email) : <span className="text-[var(--color-text-secondary)]">—</span>}</td>
                  <td className="py-2 pr-3">{org.memberCount}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={org.plan === 'PAID' ? 'brand' : 'neutral'}>{org.plan === 'PAID' ? 'Paid' : 'Free'}</Badge>
                  </td>
                  <td className="py-2 pr-3">
                    {org.subscription ? <span className={statusTone(org.subscription.status)}>{org.subscription.status.replaceAll('_', ' ').toLowerCase()}</span> : <span className="text-[var(--color-text-secondary)]">—</span>}
                  </td>
                  <td className="py-2 pr-3">
                    {org.latestPayment ? (
                      <span className={statusTone(org.latestPayment.status)}>
                        {org.latestPayment.status.toLowerCase()}{org.latestPayment.requiresManualReview ? ' ⚠' : ''}
                      </span>
                    ) : <span className="text-[var(--color-text-secondary)]">—</span>}
                  </td>
                  <td className="py-2 pr-3 text-[var(--color-text-secondary)]">{org.createdAt ? new Date(org.createdAt).toLocaleDateString() : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </WorkspaceShell>
  );
}
