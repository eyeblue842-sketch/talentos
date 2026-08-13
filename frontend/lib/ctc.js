const CTC_LAKH_MULTIPLIER = 1;
const CTC_CRORE_MULTIPLIER = 100;

function formatDecimal(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  const fixed = numeric.toFixed(2);
  return fixed.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

export function normalizeCtcToLpa(amount, unit) {
  if (amount == null || amount === '') return null;
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return null;
  if (numeric < 0) return numeric;
  return unit === 'CRORE_PER_ANNUM'
    ? Number((numeric * CTC_CRORE_MULTIPLIER).toFixed(2))
    : Number((numeric * CTC_LAKH_MULTIPLIER).toFixed(2));
}

export function deriveCtcEditorValue(lpaValue) {
  const numeric = Number(lpaValue);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { amount: '', unit: 'LAKH_PER_ANNUM' };
  }

  if (numeric >= CTC_CRORE_MULTIPLIER) {
    return {
      amount: formatDecimal(numeric / CTC_CRORE_MULTIPLIER),
      unit: 'CRORE_PER_ANNUM',
    };
  }

  return {
    amount: formatDecimal(numeric),
    unit: 'LAKH_PER_ANNUM',
  };
}

export function formatCandidateAnnualCtc(lpaValue) {
  const numeric = Number(lpaValue);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Not added';

  if (numeric >= CTC_CRORE_MULTIPLIER) {
    return `₹${formatDecimal(numeric / CTC_CRORE_MULTIPLIER)} crore per annum`;
  }

  return `₹${formatDecimal(numeric)} lakh per annum`;
}

export function getCtcFieldErrorMessage(errorMessage, fieldLabel = 'CTC') {
  if (!errorMessage) return undefined;
  if (/less than or equal to|greater than or equal to|max|min/i.test(errorMessage)) {
    return `Enter a valid ${fieldLabel.toLowerCase()}.`;
  }
  return errorMessage;
}
