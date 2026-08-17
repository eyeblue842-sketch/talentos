import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RazorpayCheckoutButton } from './razorpay-checkout-button';

const createBillingPurchaseIntent = vi.fn();
const verifyBillingCheckoutPayment = vi.fn();
vi.mock('@/lib/api', () => ({
  createBillingPurchaseIntent: (...args) => createBillingPurchaseIntent(...args),
  verifyBillingCheckoutPayment: (...args) => verifyBillingCheckoutPayment(...args),
}));

let lastCheckoutInstance = null;
const loadRazorpayCheckout = vi.fn();
vi.mock('@/lib/razorpay-loader', () => ({
  loadRazorpayCheckout: () => loadRazorpayCheckout(),
}));

function FakeRazorpay(options) {
  lastCheckoutInstance = this;
  this.options = options;
  this.handlers = {};
  this.open = vi.fn();
  this.on = vi.fn((event, callback) => {
    this.handlers[event] = callback;
  });
}

beforeEach(() => {
  createBillingPurchaseIntent.mockReset();
  verifyBillingCheckoutPayment.mockReset();
  loadRazorpayCheckout.mockReset().mockResolvedValue(FakeRazorpay);
  lastCheckoutInstance = null;
});

describe('RazorpayCheckoutButton', () => {
  it('is disabled and shows a not-configured notice when Razorpay is not enabled, and never opens checkout', async () => {
    render(<RazorpayCheckoutButton productCode="JOB_POST_45D" razorpayEnabled={false} />);
    const button = screen.getByRole('button', { name: /buy now/i });
    expect(button).toBeDisabled();
    expect(screen.getByText('Payments are not configured yet.')).toBeInTheDocument();
    expect(createBillingPurchaseIntent).not.toHaveBeenCalled();
  });

  it('walks loading -> opening -> verifying -> success on a captured payment', async () => {
    createBillingPurchaseIntent.mockResolvedValue({
      purchaseId: 'purchase-1', orderId: 'order_1', amountPaise: 177000, currency: 'INR',
      keyId: 'rzp_test_1', productSnapshot: { name: 'Single Job Posting' },
    });
    verifyBillingCheckoutPayment.mockResolvedValue({ status: 'PAID' });
    const onSuccess = vi.fn();
    const user = userEvent.setup();

    render(<RazorpayCheckoutButton productCode="JOB_POST_45D" razorpayEnabled onSuccess={onSuccess} />);
    await user.click(screen.getByRole('button', { name: /buy now/i }));

    await waitFor(() => expect(lastCheckoutInstance).not.toBeNull());
    expect(createBillingPurchaseIntent).toHaveBeenCalledWith('JOB_POST_45D', expect.any(String));
    expect(lastCheckoutInstance.options.order_id).toBe('order_1');
    expect(lastCheckoutInstance.options.key).toBe('rzp_test_1');
    expect(lastCheckoutInstance.options.amount).toBe(177000);
    expect(lastCheckoutInstance.open).toHaveBeenCalledOnce();

    await lastCheckoutInstance.options.handler({
      razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig_1',
    });

    expect(verifyBillingCheckoutPayment).toHaveBeenCalledWith({
      purchaseId: 'purchase-1', razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig_1',
    });
    expect(await screen.findByText(/Payment successful/)).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalledWith({ status: 'PAID' });
  });

  it('shows a cancelled state when the checkout modal is dismissed without paying, and never calls verify', async () => {
    createBillingPurchaseIntent.mockResolvedValue({
      purchaseId: 'purchase-2', orderId: 'order_2', amountPaise: 177000, currency: 'INR', keyId: 'rzp_test_1', productSnapshot: {},
    });
    const user = userEvent.setup();

    render(<RazorpayCheckoutButton productCode="JOB_POST_45D" razorpayEnabled />);
    await user.click(screen.getByRole('button', { name: /buy now/i }));
    await waitFor(() => expect(lastCheckoutInstance).not.toBeNull());

    lastCheckoutInstance.options.modal.ondismiss();

    expect(await screen.findByText('Checkout was cancelled.')).toBeInTheDocument();
    expect(verifyBillingCheckoutPayment).not.toHaveBeenCalled();
  });

  it('shows a failed state with the provider error when Razorpay reports payment.failed', async () => {
    createBillingPurchaseIntent.mockResolvedValue({
      purchaseId: 'purchase-3', orderId: 'order_3', amountPaise: 177000, currency: 'INR', keyId: 'rzp_test_1', productSnapshot: {},
    });
    const user = userEvent.setup();

    render(<RazorpayCheckoutButton productCode="JOB_POST_45D" razorpayEnabled />);
    await user.click(screen.getByRole('button', { name: /buy now/i }));
    await waitFor(() => expect(lastCheckoutInstance).not.toBeNull());

    lastCheckoutInstance.handlers['payment.failed']({ error: { description: 'Card declined' } });

    expect(await screen.findByText('Card declined')).toBeInTheDocument();
  });

  it('shows a failed state without opening checkout when creating the purchase intent itself fails', async () => {
    createBillingPurchaseIntent.mockRejectedValue(new Error('Payments are not configured yet.'));
    const user = userEvent.setup();

    render(<RazorpayCheckoutButton productCode="JOB_POST_45D" razorpayEnabled />);
    await user.click(screen.getByRole('button', { name: /buy now/i }));

    expect(await screen.findByText('Payments are not configured yet.')).toBeInTheDocument();
    expect(lastCheckoutInstance).toBeNull();
  });
});
