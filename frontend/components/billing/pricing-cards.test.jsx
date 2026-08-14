import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { PricingCards } from './pricing-cards';

const PRODUCTS = [
  {
    code: 'JOB_POST_45D', name: 'Single Job Posting', description: 'One job-posting credit.',
    baseAmountPaise: 150000, gstRatePercent: 18, gstAmountPaise: 27000, totalAmountPaise: 177000,
    durationMonths: null, includedJobCredits: 1, jobActiveDays: 45,
  },
  {
    code: 'ATS_DB_1M', name: 'ATS + Resume Database - Monthly', description: 'Monthly plan.',
    baseAmountPaise: 1000000, gstRatePercent: 18, gstAmountPaise: 180000, totalAmountPaise: 1180000,
    durationMonths: 1, includedJobCredits: 0, jobActiveDays: 45,
  },
  {
    code: 'ATS_DB_6M', name: 'ATS + Resume Database - 6 Months', description: 'Six month plan.',
    baseAmountPaise: 5000000, gstRatePercent: 18, gstAmountPaise: 900000, totalAmountPaise: 5900000,
    durationMonths: 6, includedJobCredits: 3, jobActiveDays: 45,
  },
  {
    code: 'ATS_DB_12M', name: 'ATS + Resume Database - Annual', description: 'Annual plan.',
    baseAmountPaise: 10000000, gstRatePercent: 18, gstAmountPaise: 1800000, totalAmountPaise: 11800000,
    durationMonths: 12, includedJobCredits: 5, jobActiveDays: 45,
  },
];

function renderCards() {
  return render(
    <PricingCards products={PRODUCTS} renderAction={(product) => <button type="button">Buy {product.code}</button>} />,
  );
}

describe('PricingCards', () => {
  it('renders all four products in spec order with correct total, base and GST amounts', () => {
    renderCards();
    const headings = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent);
    expect(headings).toEqual([
      'Single Job Posting',
      'ATS + Resume Database - Monthly',
      'ATS + Resume Database - 6 Months',
      'ATS + Resume Database - Annual',
    ]);

    expect(screen.getByText('₹1,770')).toBeInTheDocument();
    expect(screen.getByText('₹11,800')).toBeInTheDocument();
    expect(screen.getByText('₹59,000')).toBeInTheDocument();
    expect(screen.getByText('₹1,18,000')).toBeInTheDocument();
    expect(screen.getByText(/Base ₹1,500 \+ GST 18% \(₹270\)/)).toBeInTheDocument();
    expect(screen.getByText(/Base ₹1,00,000 \+ GST 18% \(₹18,000\)/)).toBeInTheDocument();
  });

  it('shows the exact included-credit and 45-day validity restrictions per plan', () => {
    renderCards();
    expect(screen.getByText('No included job-posting credits')).toBeInTheDocument();
    expect(screen.getByText('3 included job-posting credits')).toBeInTheDocument();
    expect(screen.getByText('5 included job-posting credits')).toBeInTheDocument();
    expect(screen.getAllByText(/stays live for 45 days/)).toHaveLength(4);
  });

  it('labels the plans Flexible / Popular / Best Value per the spec', () => {
    renderCards();
    expect(screen.getByText('Flexible')).toBeInTheDocument();
    expect(screen.getByText('Popular')).toBeInTheDocument();
    expect(screen.getByText('Best Value')).toBeInTheDocument();
  });

  it('computes the annual base-price saving from base prices only (not mixing pre-tax and post-tax figures)', () => {
    renderCards();
    // 12 * base(ATS_DB_1M) - base(ATS_DB_12M) = 12 * Rs.10,000 - Rs.1,00,000 = Rs.20,000
    expect(screen.getByText(/Save ₹20,000 vs\. paying monthly for 12 months \(base price comparison\)\./)).toBeInTheDocument();
  });

  it('never advertises a free trial', () => {
    renderCards();
    expect(screen.queryByText(/free trial/i)).not.toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = renderCards();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
