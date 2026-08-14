import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { recruiterNav } from '@/lib/navigation';
import { getCurrentOrganisation, getBillingDashboard, getBillingEntitlementSummary, getBillingCatalogue } from '@/lib/api';
import { PricingCards } from '@/components/billing/pricing-cards';
import { RazorpayCheckoutButton } from '@/components/billing/razorpay-checkout-button';
import { BillingProfileForm } from '@/components/billing/billing-profile-form';
import { CancelSubscriptionButton } from '@/components/billing/cancel-subscription-button';
import {
  formatPaise,
  formatBillingDate,
  daysRemaining,
  purchaseStatusLabel,
  subscriptionStatusLabel,
} from '@/lib/billing-format';

const CANCELLABLE_STATUSES = new Set(['ACTIVE', 'EXPIRING_SOON', 'PENDING_PAYMENT']);
const SUBSCRIPTION_BADGE_TONE = {
  ACTIVE: 'success',
  EXPIRING_SOON: 'warning',
  PENDING_PAYMENT: 'warning',
  EXPIRED: 'neutral',
  CANCELLED: 'neutral',
  PAYMENT_FAILED: 'danger',
  REFUNDED: 'neutral',
  SUSPENDED: 'danger',
};
const PURCHASE_BADGE_TONE = {
  PAID: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
  REFUNDED: 'neutral',
  PARTIALLY_REFUNDED: 'neutral',
  CANCELLED: 'neutral',
};

// B2 hardening, section 1: full billing detail (invoices, payment
// references, purchase history, GSTIN/address) is OWNER/ADMIN/platform-
// admin only, enforced server-side by getBillingDashboard requiring
// 'organisation.billing.read'. A plain RECRUITER/HIRING_MANAGER gets a 403
// from that call and falls back to the minimal, non-financial entitlement
// summary below - this page never guesses the viewer's role client-side,
// it just reacts to which call the server actually allowed.
function MinimalEntitlementView({ organisation, summary, catalogue }) {
  const remaining = daysRemaining(summary.subscriptionExpiresAt);

  return (
    <WorkspaceShell brand={organisation.name} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation.slug}
        title="Plan & job credits"
        description="Your workspace's ATS and resume-database access, and remaining job-posting credits. Full billing management (invoices, payment history, billing details) is available to organisation owners and admins."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Billing' }]}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="ATS access"
          value={summary.hasActiveAtsAccess ? 'Active' : 'Inactive'}
        />
        <StatCard
          label="Resume database access"
          value={summary.hasActiveResumeDatabaseAccess ? 'Active' : 'Inactive'}
        />
        <StatCard
          label="Plan expiry"
          value={remaining != null ? `${remaining} days` : '-'}
          helper={summary.subscriptionExpiresAt ? formatBillingDate(summary.subscriptionExpiresAt) : 'No active plan'}
        />
        <StatCard label="Available job credits" value={summary.availableJobCredits} />
      </div>

      {summary.renewalRequired ? (
        <Card variant="outlined" role="status" className="border-amber-300 bg-amber-50">
          <p className="text-sm font-medium text-amber-900">
            This workspace&apos;s plan needs renewal soon. Ask an organisation owner or admin to renew from the full billing dashboard.
          </p>
        </Card>
      ) : null}

      <Card>
        <h3 className="text-xl font-semibold text-[var(--color-text)]">Plans</h3>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Purchasing and renewing requires organisation owner/admin access.
        </p>
        <div className="mt-5">
          <PricingCards
            products={catalogue.products}
            renderAction={() => (
              <p className="text-sm text-[var(--color-text-muted)]">Ask an owner or admin to purchase this plan.</p>
            )}
          />
        </div>
      </Card>
    </WorkspaceShell>
  );
}

export default async function RecruiterBillingPage() {
  let organisation = null;
  let dashboard = null;
  let summary = null;
  let catalogue = null;
  let loadError = '';
  let accessDenied = false;

  try {
    [organisation, catalogue] = await Promise.all([getCurrentOrganisation(), getBillingCatalogue()]);
  } catch (caught) {
    loadError = caught.message || 'Could not load billing information.';
  }

  if (!loadError) {
    try {
      dashboard = await getBillingDashboard();
    } catch (caught) {
      if (caught.statusCode === 403) {
        accessDenied = true;
      } else {
        loadError = caught.message || 'Could not load billing information.';
      }
    }
  }

  if (!loadError && accessDenied) {
    try {
      summary = await getBillingEntitlementSummary();
    } catch (caught) {
      loadError = caught.message || 'Could not load billing information.';
    }
  }

  if (loadError || !catalogue || (!dashboard && !summary)) {
    return (
      <WorkspaceShell brand={organisation?.name || 'Careeriz Hire'} items={recruiterNav}>
        <PageHeader
          eyebrow="Recruiter"
          title="Billing & subscription"
          description="Manage your Careeriz plan, job-posting credits, and payment history."
          breadcrumb={[{ label: 'Recruiter' }, { label: 'Billing' }]}
        />
        <Card role="alert">
          <p className="text-sm text-[var(--color-text-secondary)]">{loadError || 'Loading billing information failed. Please refresh.'}</p>
        </Card>
      </WorkspaceShell>
    );
  }

  if (accessDenied) {
    return <MinimalEntitlementView organisation={organisation} summary={summary} catalogue={catalogue} />;
  }

  const { subscription } = dashboard;
  const remaining = daysRemaining(dashboard.subscriptionExpiresAt);
  const totalGranted = dashboard.creditBreakdown.includedGranted + dashboard.creditBreakdown.purchasedGranted + dashboard.creditBreakdown.adminAdjusted;
  const hasNoCreditsAndNoPlan = dashboard.availableJobCredits === 0 && !subscription;

  return (
    <WorkspaceShell brand={organisation.name} items={recruiterNav}>
      <PageHeader
        eyebrow={organisation.slug}
        title="Billing & subscription"
        description="Manage your Careeriz plan, job-posting credits, and payment history."
        breadcrumb={[{ label: 'Recruiter' }, { label: 'Billing' }]}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Plan status"
          value={subscription ? subscriptionStatusLabel(subscription.status) : 'No active plan'}
          helper={subscription ? `Expires ${formatBillingDate(dashboard.subscriptionExpiresAt)}` : 'Choose a plan below'}
        />
        <StatCard label="Days remaining" value={remaining != null ? remaining : '-'} helper={remaining != null ? 'Until plan expiry' : undefined} />
        <StatCard
          label="Available job credits"
          value={dashboard.availableJobCredits}
          helper={`${dashboard.creditBreakdown.consumed} used of ${totalGranted} granted`}
        />
        <StatCard
          label="ATS / Resume DB access"
          value={dashboard.hasActiveAtsAccess ? 'Active' : 'Inactive'}
          helper={dashboard.hasActiveResumeDatabaseAccess ? 'Resume database included' : undefined}
        />
      </div>

      {!catalogue.razorpayEnabled ? (
        <Card variant="outlined" role="status" className="border-amber-300 bg-amber-50">
          <p className="text-sm font-medium text-amber-900">
            Payments are not fully configured yet (Razorpay Test Mode credentials are missing). Purchases are disabled until an administrator
            completes setup.
          </p>
        </Card>
      ) : null}

      {subscription?.status === 'SUSPENDED' ? (
        <Card variant="outlined" role="alert" className="border-rose-300 bg-rose-50">
          <p className="text-sm font-medium text-rose-900">Your subscription is suspended{subscription.suspensionReason ? `: ${subscription.suspensionReason}` : '.'} Contact support to resolve this.</p>
        </Card>
      ) : null}

      {subscription && !dashboard.hasActiveAtsAccess && subscription.status !== 'SUSPENDED' ? (
        <Card variant="outlined" role="status" className="border-amber-300 bg-amber-50">
          <p className="text-sm font-medium text-amber-900">Your subscription has expired. Renew below to restore ATS and resume-database access.</p>
        </Card>
      ) : null}

      {hasNoCreditsAndNoPlan ? (
        <Card variant="outlined" role="status" className="border-amber-300 bg-amber-50">
          <p className="text-sm font-medium text-amber-900">You have no job-posting credits available. Buy a credit or subscribe to a plan below before publishing a job.</p>
        </Card>
      ) : null}

      <Card>
        <h3 className="text-xl font-semibold text-[var(--color-text)]">Current plan</h3>
        {subscription ? (
          <div className="mt-4 grid gap-3 text-sm text-[var(--color-text-secondary)] md:grid-cols-2">
            <p><span className="font-medium text-[var(--color-text)]">Plan:</span> {subscription.productCode}</p>
            <p>
              <span className="font-medium text-[var(--color-text)]">Status:</span>{' '}
              <Badge tone={SUBSCRIPTION_BADGE_TONE[subscription.status] || 'neutral'}>{subscriptionStatusLabel(subscription.status)}</Badge>
            </p>
            <p><span className="font-medium text-[var(--color-text)]">Started:</span> {formatBillingDate(subscription.startsAt)}</p>
            <p>
              <span className="font-medium text-[var(--color-text)]">{subscription.status === 'CANCELLED' && dashboard.hasActiveAtsAccess ? 'Access until:' : 'Expires:'}</span>{' '}
              {formatBillingDate(subscription.expiresAt)}
              {subscription.status === 'CANCELLED' && dashboard.hasActiveAtsAccess ? ' (will not renew)' : ''}
            </p>
            <p><span className="font-medium text-[var(--color-text)]">Included job credits:</span> {subscription.includedJobCredits}</p>
            <p>
              <span className="font-medium text-[var(--color-text)]">Renewal reminder:</span>{' '}
              {subscription.renewalReminderSentAt ? `Sent ${formatBillingDate(subscription.renewalReminderSentAt)}` : 'Not sent yet'}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">No active subscription. Purchase a plan below to unlock ATS and resume-database access.</p>
        )}
        {subscription && CANCELLABLE_STATUSES.has(subscription.status) ? (
          <div className="mt-5">
            <CancelSubscriptionButton expiresAt={subscription.expiresAt} />
          </div>
        ) : null}
      </Card>

      <Card>
        <h3 className="text-xl font-semibold text-[var(--color-text)]">Job-posting credits</h3>
        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2 md:grid-cols-4">
          <div>
            <p className="text-[var(--color-text-muted)]">Included (plan)</p>
            <p className="text-lg font-semibold text-[var(--color-text)]">{dashboard.creditBreakdown.includedGranted}</p>
          </div>
          <div>
            <p className="text-[var(--color-text-muted)]">Purchased separately</p>
            <p className="text-lg font-semibold text-[var(--color-text)]">{dashboard.creditBreakdown.purchasedGranted}</p>
          </div>
          <div>
            <p className="text-[var(--color-text-muted)]">Consumed</p>
            <p className="text-lg font-semibold text-[var(--color-text)]">{dashboard.creditBreakdown.consumed}</p>
          </div>
          <div>
            <p className="text-[var(--color-text-muted)]">Available now</p>
            <p className="text-lg font-semibold text-[var(--color-primary)]">{dashboard.creditBreakdown.available}</p>
          </div>
        </div>
        <div className="mt-5 max-w-xs">
          <RazorpayCheckoutButton
            productCode="JOB_POST_45D"
            label={`Buy 1 job credit - ${formatPaise(177000)}`}
            razorpayEnabled={catalogue.razorpayEnabled}
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-xl font-semibold text-[var(--color-text)]">Plans</h3>
        <div className="mt-5">
          <PricingCards
            products={catalogue.products}
            renderAction={(product) => (
              <RazorpayCheckoutButton
                productCode={product.code}
                label={product.code === 'JOB_POST_45D' ? 'Buy credit' : 'Subscribe'}
                razorpayEnabled={catalogue.razorpayEnabled}
              />
            )}
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-xl font-semibold text-[var(--color-text)]">Active jobs</h3>
        {dashboard.jobs.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-[var(--color-text-muted)]">
                <tr>
                  <th scope="col" className="pb-2 pr-4 font-medium">Job</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Status</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Activated</th>
                  <th scope="col" className="pb-2 font-medium">Active until</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.jobs.map((job) => (
                  <tr key={job.id} className="border-t border-[var(--color-border)]">
                    <td className="py-2 pr-4">{job.title}</td>
                    <td className="py-2 pr-4"><Badge tone={job.status === 'OPEN' ? 'success' : 'neutral'}>{job.status}</Badge></td>
                    <td className="py-2 pr-4">{formatBillingDate(job.activatedAt)}</td>
                    <td className="py-2">{formatBillingDate(job.activeUntil)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">No jobs have been activated yet.</p>
        )}
      </Card>

      <Card>
        <h3 className="text-xl font-semibold text-[var(--color-text)]">Payment history</h3>
        {dashboard.purchases.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-[var(--color-text-muted)]">
                <tr>
                  <th scope="col" className="pb-2 pr-4 font-medium">Date</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Product</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Amount</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Status</th>
                  <th scope="col" className="pb-2 font-medium">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.purchases.map((purchase) => (
                  <tr key={purchase.id} className="border-t border-[var(--color-border)]">
                    <td className="py-2 pr-4">{formatBillingDate(purchase.createdAt)}</td>
                    <td className="py-2 pr-4">{purchase.productSnapshot?.name || purchase.productCode}</td>
                    <td className="py-2 pr-4">{formatPaise(purchase.amountPaise)}</td>
                    <td className="py-2 pr-4">
                      <Badge tone={PURCHASE_BADGE_TONE[purchase.status] || 'neutral'}>{purchaseStatusLabel(purchase.status)}</Badge>
                      {purchase.requiresManualReview ? <span className="ml-2 text-xs text-amber-700">Under review</span> : null}
                    </td>
                    <td className="py-2">
                      {purchase.invoice?.invoiceNumber || '-'}
                      {purchase.invoice?.status === 'REVIEW_REQUIRED' ? (
                        <span className="ml-2 text-xs text-amber-700" title="GST split pending - complete your billing details to finalise this invoice.">
                          GST split pending
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">No payments yet.</p>
        )}
      </Card>

      <Card>
        <h3 className="text-xl font-semibold text-[var(--color-text)]">Billing details</h3>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Used to generate GST-compliant invoices for your organisation.</p>
        <div className="mt-4">
          <BillingProfileForm initialProfile={dashboard.billingProfile} />
        </div>
      </Card>
    </WorkspaceShell>
  );
}
