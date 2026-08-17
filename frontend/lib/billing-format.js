// Indian currency/number formatting for the billing module. All amounts
// arrive from the backend as integer paise (never floats) - these helpers
// are the only place paise is divided down to rupees for display.
const rupeeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatPaise(paise) {
  if (paise == null || Number.isNaN(Number(paise))) return rupeeFormatter.format(0);
  return rupeeFormatter.format(Math.round(Number(paise) / 100));
}

export function formatBillingDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return dateFormatter.format(date);
}

export function daysRemaining(expiresAt) {
  if (!expiresAt) return null;
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

export const PRODUCT_LABELS = {
  JOB_POST_45D: 'Single Job Posting',
  ATS_DB_1M: 'ATS + Database - Monthly',
  ATS_DB_6M: 'ATS + Database - 6 Months',
  ATS_DB_12M: 'ATS + Database - Annual',
};

export const PRODUCT_TAGLINES = {
  JOB_POST_45D: null,
  ATS_DB_1M: 'Flexible',
  ATS_DB_6M: 'Popular',
  ATS_DB_12M: 'Best Value',
};

export function purchaseStatusLabel(status) {
  const labels = {
    PENDING: 'Payment pending',
    PAID: 'Paid',
    FAILED: 'Payment failed',
    REFUNDED: 'Refunded',
    PARTIALLY_REFUNDED: 'Partially refunded',
    CANCELLED: 'Cancelled',
  };
  return labels[status] || status;
}

export function subscriptionStatusLabel(status) {
  const labels = {
    PENDING_PAYMENT: 'Payment pending',
    ACTIVE: 'Active',
    EXPIRING_SOON: 'Expiring soon',
    EXPIRED: 'Expired',
    // "Cancelled" here means renewal was stopped - access itself continues
    // normally until expiresAt (see cancel-subscription-button.jsx). Kept
    // deliberately neutral (neither "active" nor "expired") since this
    // label alone doesn't know whether expiresAt has passed yet - the
    // billing dashboard pairs it with the actual expiry date/access state.
    CANCELLED: 'Renewal cancelled',
    PAYMENT_FAILED: 'Payment failed',
    REFUNDED: 'Refunded',
    SUSPENDED: 'Suspended',
  };
  return labels[status] || status;
}
