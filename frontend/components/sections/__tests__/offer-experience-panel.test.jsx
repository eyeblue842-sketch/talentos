import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OfferExperiencePanel } from '../offer-experience-panel';

const noop = vi.fn();

const offer = {
  id: 'offer-1',
  status: 'RELEASED',
  referenceNumber: 'OFR-20260721-1-TEST',
  version: 1,
  currency: 'INR',
  totalCompensation: 1800000,
  annualCompensation: 1800000,
  fixedCompensation: 1400000,
  variableCompensation: 200000,
  joiningBonus: 100000,
  otherCompensation: 50000,
  proposedJoiningDate: '2026-08-15T00:00:00.000Z',
  expiryAt: '2026-07-28T00:00:00.000Z',
  pdfDownloadUrl: '/api/offers/candidate/offer-1/pdf',
  termsAndConditions: 'Standard employment terms apply.',
  candidate: { fullName: 'Aarav Sharma' },
  organisation: { name: 'Acme Labs' },
  job: { title: 'Senior Java Engineer', department: 'Engineering', location: 'Bangalore', employmentType: 'FULL_TIME' },
  components: [{ id: 'component-1', label: 'Joining bonus', amount: 100000, frequency: 'ONE_TIME', type: 'BONUS' }],
};

describe('OfferExperiencePanel', () => {
  it('renders core offer details and candidate actions for released offers', () => {
    render(
      <OfferExperiencePanel
        offer={offer}
        acceptAction={noop}
        rejectAction={noop}
        requestRevisionAction={noop}
      />,
    );

    expect(screen.getByRole('heading', { name: /offer detail/i })).toBeInTheDocument();
    expect(screen.getByText(/Acme Labs/)).toBeInTheDocument();
    expect(screen.getByText(/Senior Java Engineer/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept offer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject offer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request revision/i })).toBeInTheDocument();
  });
});
