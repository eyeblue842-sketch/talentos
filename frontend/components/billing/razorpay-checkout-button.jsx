"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { loadRazorpayCheckout } from '@/lib/razorpay-loader';
import { createBillingPurchaseIntent, verifyBillingCheckoutPayment } from '@/lib/api';

// Section 6/12: opening checkout, or the checkout modal reporting success,
// never grants access by itself - the `handler` callback below only calls
// verifyBillingCheckoutPayment (server-side signature + captured-status
// check), and even that is a UX fast-path; the webhook remains the
// authoritative grant (see backend billingService.activatePurchase, which
// both paths call idempotently).
export function RazorpayCheckoutButton({
  productCode,
  label = 'Buy now',
  razorpayEnabled,
  onSuccess,
  variant = 'primary',
  size = 'md',
  className,
}) {
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState(null);

  const isBusy = status === 'loading' || status === 'opening' || status === 'verifying';

  async function handleClick() {
    if (!razorpayEnabled) {
      setStatus('failed');
      setErrorMessage('Payments are not configured yet. Contact an administrator.');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const intent = await createBillingPurchaseIntent(productCode, idempotencyKey);
      const RazorpayCtor = await loadRazorpayCheckout();
      setStatus('opening');

      const checkout = new RazorpayCtor({
        key: intent.keyId,
        amount: intent.amountPaise,
        currency: intent.currency,
        name: 'Careeriz',
        description: intent.productSnapshot?.name,
        order_id: intent.orderId,
        handler: async (response) => {
          setStatus('verifying');
          try {
            const activated = await verifyBillingCheckoutPayment({
              purchaseId: intent.purchaseId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setStatus('success');
            onSuccess?.(activated);
          } catch (error) {
            setStatus('failed');
            setErrorMessage(error?.message || 'We could not verify your payment yet. It may still be processing - check your billing dashboard shortly.');
          }
        },
        modal: {
          ondismiss: () => {
            setStatus((current) => (current === 'verifying' || current === 'success' ? current : 'cancelled'));
          },
        },
        theme: { color: '#4F9CF9' },
      });

      checkout.on('payment.failed', (event) => {
        setStatus('failed');
        setErrorMessage(event?.error?.description || 'Payment failed. No charge was completed.');
      });

      checkout.open();
    } catch (error) {
      setStatus('failed');
      setErrorMessage(error?.message || 'Could not start checkout.');
    }
  }

  return (
    <div className={className}>
      <Button type="button" onClick={handleClick} loading={isBusy} disabled={!razorpayEnabled} variant={variant} size={size} className="w-full">
        {label}
      </Button>
      {!razorpayEnabled ? (
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">Payments are not configured yet.</p>
      ) : null}
      {status === 'cancelled' ? (
        <p role="status" className="mt-2 text-xs text-[var(--color-text-muted)]">Checkout was cancelled.</p>
      ) : null}
      {status === 'failed' && errorMessage ? (
        <p role="alert" className="mt-2 text-xs text-[var(--color-danger)]">{errorMessage}</p>
      ) : null}
      {status === 'success' ? (
        <p role="status" className="mt-2 text-xs text-emerald-700">Payment successful. Your plan has been updated.</p>
      ) : null}
    </div>
  );
}
