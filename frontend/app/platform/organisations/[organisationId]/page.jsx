import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { platformNav } from '@/lib/navigation';
import { getPlatformOrganisation, getPlatformComplimentaryPlans } from '@/lib/api';
import { PlatformBillingActions } from '@/components/platform/billing-actions';
import { PlatformUserAdmin } from '@/components/platform/user-admin';

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}
function fmt(value) {
  return value ? new Date(value).toLocaleString() : '—';
}
function fmtDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—';
}
function statusTone(status) {
  const s = String(status || '').toUpperCase();
  if (['PAID', 'ACTIVE', 'EXPIRING_SOON'].includes(s)) return 'text-emerald-600';
  if (['FAILED', 'PAYMENT_FAILED', 'SUSPENDED', 'EXPIRED'].includes(s)) return 'text-rose-600';
  if (['PENDING', 'PENDING_PAYMENT'].includes(s)) return 'text-amber-600';
  return 'text-[var(--color-text-secondary)]';
}
function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-[var(--color-text)]">{children ?? '—'}</p>
    </div>
  );
}

export default async function PlatformOrganisationDetailPage({ params }) {
  const { organisationId } = await params;
  let data = null;
  let error = '';
  let complimentaryPlans = [];
  try {
    data = await getPlatformOrganisation(organisationId);
    complimentaryPlans = await getPlatformComplimentaryPlans();
  } catch (caught) {
    error = caught.message;
  }
  const org = data?.organisation;
  const sub = data?.currentSubscription;

  return (
    <WorkspaceShell brand="Careeriz Platform" items={platformNav}>
      <PageHeader
        eyebrow="Platform"
        title={org?.name || 'Organisation'}
        description={org?.slug || 'Organisation detail'}
        breadcrumb={[{ label: 'Platform', href: '/platform' }, { label: 'Organisations', href: '/platform/organisations' }, { label: org?.name || 'Detail' }]}
        secondaryActions={[{ label: 'Back to organisations', href: '/platform/organisations' }]}
      />

      {error ? (
        <Card><p className="text-sm text-[var(--color-text-secondary)]">{error}</p></Card>
      ) : data ? (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Profile</h2>
              <Badge tone={data.plan === 'PAID' ? 'brand' : 'neutral'}>{data.plan === 'PAID' ? 'Paid plan' : 'Free plan'}</Badge>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <Field label="Type">{org.type || '—'}</Field>
              <Field label="Status">{org.status}</Field>
              <Field label="Industry">{org.industry}</Field>
              <Field label="Size">{org.organisationSize}</Field>
              <Field label="Headquarters">{org.headquarters}</Field>
              <Field label="Domain">{org.verifiedDomain ? `${org.verifiedDomain} (${org.domainVerificationStatus})` : '—'}</Field>
              <Field label="Website">{org.website}</Field>
              <Field label="Registered">{fmtDate(org.createdAt)}</Field>
              <Field label="Onboarded">{fmtDate(org.onboardingCompletedAt)}</Field>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Current subscription</h2>
            {sub ? (
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <Field label="Status"><span className={statusTone(sub.status)}>{sub.status.replaceAll('_', ' ').toLowerCase()}</span></Field>
                <Field label="Plan">{sub.productCode}</Field>
                <Field label="Active now">{sub.isActive ? 'Yes' : 'No'}</Field>
                <Field label="Starts">{fmtDate(sub.startsAt)}</Field>
                <Field label="Expires">{fmtDate(sub.expiresAt)}</Field>
                <Field label="Job credits">{sub.includedJobCredits}</Field>
                <Field label="ATS access">{sub.atsAccess ? 'Yes' : 'No'}</Field>
                <Field label="Resume DB access">{sub.resumeDatabaseAccess ? 'Yes' : 'No'}</Field>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">No subscription — this organisation is on the free plan.</p>
            )}
          </Card>

          <PlatformBillingActions
            organisationId={org.id}
            subscription={sub}
            payments={data.payments}
            complimentaryPlans={complimentaryPlans}
          />

          <Card className="overflow-x-auto">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Members</h2>
            <table className="mt-3 w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Org role</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Email verified</th>
                  <th className="py-2 pr-3">Last login</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.membershipId} className="border-b border-[var(--line)] last:border-0">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-[var(--color-text)]">{m.user?.name || m.user?.email || '—'}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{m.user?.email}</p>
                    </td>
                    <td className="py-2 pr-3">{m.role}</td>
                    <td className="py-2 pr-3">{m.status}{m.user && !m.user.isActive ? ' · inactive' : ''}</td>
                    <td className="py-2 pr-3">{m.user?.emailVerified ? 'Yes' : 'No'}</td>
                    <td className="py-2 pr-3 text-[var(--color-text-secondary)]">{m.user?.lastLoginAt ? fmtDate(m.user.lastLoginAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <PlatformUserAdmin organisationId={org.id} members={data.members} />

          <Card className="overflow-x-auto">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Payments</h2>
            {data.payments.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">No payments.</p>
            ) : (
              <table className="mt-3 w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
                    <th className="py-2 pr-3">Product</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Provider refs</th>
                    <th className="py-2 pr-3">Invoice</th>
                    <th className="py-2 pr-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p) => (
                    <tr key={p.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="py-2 pr-3">{p.productCode}</td>
                      <td className="py-2 pr-3">{money(p.amount)}</td>
                      <td className="py-2 pr-3"><span className={statusTone(p.status)}>{p.status.toLowerCase()}</span>{p.requiresManualReview ? ' ⚠' : ''}</td>
                      <td className="py-2 pr-3 text-xs text-[var(--color-text-secondary)]">{p.providerPaymentId || p.providerOrderId || '—'}</td>
                      <td className="py-2 pr-3">{p.invoice ? p.invoice.invoiceNumber : '—'}</td>
                      <td className="py-2 pr-3 text-[var(--color-text-secondary)]">{fmtDate(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card className="overflow-x-auto">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Subscription history</h2>
            {data.subscriptions.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">No subscriptions.</p>
            ) : (
              <table className="mt-3 w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
                    <th className="py-2 pr-3">Plan</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Starts</th>
                    <th className="py-2 pr-3">Expires</th>
                    <th className="py-2 pr-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subscriptions.map((s) => (
                    <tr key={s.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="py-2 pr-3">{s.productCode}</td>
                      <td className="py-2 pr-3"><span className={statusTone(s.status)}>{s.status.replaceAll('_', ' ').toLowerCase()}</span></td>
                      <td className="py-2 pr-3 text-[var(--color-text-secondary)]">{fmtDate(s.startsAt)}</td>
                      <td className="py-2 pr-3 text-[var(--color-text-secondary)]">{fmtDate(s.expiresAt)}</td>
                      <td className="py-2 pr-3 text-[var(--color-text-secondary)]">{fmtDate(s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

        </>
      ) : null}
    </WorkspaceShell>
  );
}
