'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import {
  suspendSubscriptionAction,
  reactivateSubscriptionAction,
  adjustCreditsAction,
  resendRenewalReminderAction,
  reconcilePurchaseAction,
  reviewRefundAction,
  grantComplimentaryAction,
} from '@/app/platform/actions';

const ACTIVE_STATUSES = ['ACTIVE', 'EXPIRING_SOON'];
// Payments a super admin can act on from the console.
const RECONCILABLE = ['PENDING', 'FAILED'];

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

// A single confirmation dialog, adapted per action via `active`. Every action
// requires a typed reason (recorded in the backend audit log); some need an
// extra field (a Razorpay reference to reconcile, a signed amount for credits).
export function PlatformBillingActions({ organisationId, subscription, payments = [], complimentaryPlans = [] }) {
  const router = useRouter();
  const { push } = useToast();
  const [active, setActive] = useState(null); // { key, title, description, fields, run }
  const [reason, setReason] = useState('');
  const [providerReference, setProviderReference] = useState('');
  const [amount, setAmount] = useState('');
  const [productCode, setProductCode] = useState('');
  const [saving, setSaving] = useState(false);

  function open(config) {
    setReason('');
    setProviderReference('');
    setAmount('');
    setProductCode(config.fields?.includes('productCode') ? (complimentaryPlans[0]?.code || '') : '');
    setActive(config);
  }
  function close() {
    if (saving) return;
    setActive(null);
  }

  async function submit() {
    if (!active) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      push({ tone: 'error', title: 'Reason required', description: 'Add a short reason — it is recorded in the audit log.' });
      return;
    }
    if (active.fields?.includes('providerReference') && !providerReference.trim()) {
      push({ tone: 'error', title: 'Reference required', description: 'Enter the Razorpay payment id to reconcile against.' });
      return;
    }
    let numericAmount;
    if (active.fields?.includes('amount')) {
      numericAmount = Number(amount);
      if (!Number.isInteger(numericAmount) || numericAmount === 0) {
        push({ tone: 'error', title: 'Invalid amount', description: 'Enter a non-zero whole number (negative to deduct).' });
        return;
      }
    }
    if (active.fields?.includes('productCode') && !productCode) {
      push({ tone: 'error', title: 'Plan required', description: 'Choose the subscription plan to grant.' });
      return;
    }
    setSaving(true);
    try {
      const result = await active.run({ reason: trimmedReason, providerReference: providerReference.trim(), amount: numericAmount, productCode });
      if (result?.ok) {
        push({ tone: 'success', title: active.successTitle || 'Done', description: active.successDescription });
        setActive(null);
        router.refresh();
      } else {
        push({ tone: 'error', title: 'Action failed', description: result?.error || 'The operation could not be completed.' });
      }
    } catch (error) {
      push({ tone: 'error', title: 'Action failed', description: error.message });
    } finally {
      setSaving(false);
    }
  }

  const subStatus = subscription?.status || null;
  const isActive = subscription?.isActive || ACTIVE_STATUSES.includes(subStatus);
  const isSuspended = subStatus === 'SUSPENDED';

  const actionablePayments = payments.filter(
    (p) => p.requiresManualReview || RECONCILABLE.includes(String(p.status || '').toUpperCase()),
  );

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Billing operations</h2>
        <span className="text-xs text-[var(--color-text-secondary)]">All actions are audited</span>
      </div>

      {/* Subscription-level operations */}
      <div className="mt-3 flex flex-wrap gap-2">
        {subscription ? (
          <>
            {isActive && !isSuspended ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => open({
                  key: 'suspend',
                  title: 'Suspend subscription',
                  description: `Immediately suspend ${subscription.productCode}. ATS / resume access is withdrawn until reactivated.`,
                  fields: ['reason'],
                  successTitle: 'Subscription suspended',
                  run: ({ reason: r }) => suspendSubscriptionAction(organisationId, r),
                })}
              >
                Suspend subscription
              </Button>
            ) : null}
            {isSuspended ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => open({
                  key: 'reactivate',
                  title: 'Reactivate subscription',
                  description: `Restore ${subscription.productCode} to active. Access is granted again for the remaining term.`,
                  fields: ['reason'],
                  successTitle: 'Subscription reactivated',
                  run: ({ reason: r }) => reactivateSubscriptionAction(organisationId, r),
                })}
              >
                Reactivate subscription
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => open({
                key: 'reminder',
                title: 'Resend renewal reminder',
                description: 'Email the organisation owner a renewal reminder for the current subscription.',
                fields: ['reason'],
                successTitle: 'Reminder sent',
                run: ({ reason: r }) => resendRenewalReminderAction(organisationId, r),
              })}
            >
              Resend renewal reminder
            </Button>
          </>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">
            No subscription yet — this organisation is on the free plan.
          </p>
        )}
        {complimentaryPlans.length > 0 ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => open({
              key: 'complimentary',
              title: 'Grant complimentary subscription',
              description: 'Grant a free subscription. The full access term and included job credits are applied at ₹0 — a correct zero-value invoice is recorded and no payment is marked as collected. If a term is already active, this extends it.',
              fields: ['reason', 'productCode'],
              successTitle: 'Complimentary subscription granted',
              run: ({ productCode: pc, reason: r }) => grantComplimentaryAction(organisationId, pc, r),
            })}
          >
            Grant complimentary subscription
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => open({
            key: 'credits',
            title: 'Adjust job-posting credits',
            description: 'Add or deduct job-posting credits. Use a negative number to deduct. Recorded as an admin ledger adjustment.',
            fields: ['reason', 'amount'],
            successTitle: 'Credits adjusted',
            run: ({ amount: a, reason: r }) => adjustCreditsAction(organisationId, a, r),
          })}
        >
          Adjust job credits
        </Button>
      </div>

      {/* Payment-level operations */}
      {actionablePayments.length > 0 ? (
        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Payments needing attention</h3>
          <ul className="mt-2 space-y-2">
            {actionablePayments.map((p) => {
              const reconcilable = RECONCILABLE.includes(String(p.status || '').toUpperCase());
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--line)] px-3 py-2">
                  <span className="text-sm text-[var(--color-text)]">
                    {p.productCode} · {money(p.amount)} · <span className="lowercase">{p.status}</span>
                    {p.requiresManualReview ? <span className="ml-1 text-amber-600">⚠ flagged</span> : null}
                  </span>
                  <span className="flex flex-wrap gap-2">
                    {reconcilable ? (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => open({
                          key: 'reconcile',
                          title: 'Reconcile payment',
                          description: 'Re-verify this payment with Razorpay and activate the entitlement only if it is genuinely captured and matches. Idempotent and safe to retry.',
                          fields: ['reason', 'providerReference'],
                          successTitle: 'Payment reconciled',
                          run: ({ providerReference: ref, reason: r }) => reconcilePurchaseAction(organisationId, p.id, ref, r),
                        })}
                      >
                        Reconcile
                      </Button>
                    ) : null}
                    {p.requiresManualReview ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => open({
                            key: 'refund-approve',
                            title: 'Clear flagged refund — approve',
                            description: 'Mark this flagged refund as reviewed and approved. This only clears the review flag; it does not move money or credits.',
                            fields: ['reason'],
                            successTitle: 'Refund reviewed',
                            run: ({ reason: r }) => reviewRefundAction(organisationId, p.id, true, r),
                          })}
                        >
                          Review — approve
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => open({
                            key: 'refund-reject',
                            title: 'Clear flagged refund — reject',
                            description: 'Mark this flagged refund as reviewed and rejected. This only clears the review flag; it does not move money or credits.',
                            fields: ['reason'],
                            successTitle: 'Refund reviewed',
                            run: ({ reason: r }) => reviewRefundAction(organisationId, p.id, false, r),
                          })}
                        >
                          Review — reject
                        </Button>
                      </>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <Dialog open={Boolean(active)} onClose={close} title={active?.title} description={active?.description}>
        <div className="space-y-4">
          {active?.fields?.includes('productCode') ? (
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="pba-plan">Subscription plan</label>
              <Select id="pba-plan" value={productCode} onChange={(e) => setProductCode(e.target.value)} disabled={saving}>
                {complimentaryPlans.map((plan) => (
                  <option key={plan.code} value={plan.code}>
                    {plan.name} — {plan.durationMonths}mo, {plan.includedJobCredits} credits
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          {active?.fields?.includes('providerReference') ? (
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="pba-ref">Razorpay payment id</label>
              <Input id="pba-ref" value={providerReference} onChange={(e) => setProviderReference(e.target.value)} placeholder="pay_XXXXXXXXXXXXXX" disabled={saving} />
            </div>
          ) : null}
          {active?.fields?.includes('amount') ? (
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="pba-amount">Credit adjustment (whole number, negative to deduct)</label>
              <Input id="pba-amount" type="number" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5 or -2" disabled={saving} />
            </div>
          ) : null}
          <div>
            <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="pba-reason">Reason (audited)</label>
            <Textarea id="pba-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Why are you taking this action?" disabled={saving} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close} disabled={saving}>Cancel</Button>
            <Button type="button" variant="primary" onClick={submit} loading={saving}>Confirm</Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
