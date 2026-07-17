import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { PublicJobApplyAction, getApplyHref, getApplyStateLabel } from '../public-job-apply-action';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

describe('PublicJobApplyAction', () => {
  test('renders login state for anonymous users when login is required', () => {
    render(<PublicJobApplyAction user={null} eligibility={{ requiresLogin: true }} slug="frontend-engineer" />);

    expect(screen.getByRole('link', { name: 'Login to Apply' })).toHaveAttribute('href', '/auth?next=/jobs/frontend-engineer/apply');
  });

  test('renders closed or duplicate states without navigation', () => {
    const { rerender } = render(<PublicJobApplyAction user={{ id: 'candidate-1' }} eligibility={{ reasonCode: 'ALREADY_APPLIED' }} slug="frontend-engineer" />);
    expect(screen.getByText('Already Applied')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Already Applied' })).not.toBeInTheDocument();

    rerender(<PublicJobApplyAction user={{ id: 'candidate-1' }} eligibility={{ reasonCode: 'APPLICATION_CLOSED' }} slug="frontend-engineer" />);
    expect(screen.getByText('Applications Closed')).toBeInTheDocument();
  });

  test('keeps resume-required users on the authenticated application route', () => {
    expect(getApplyStateLabel({ id: 'candidate-1' }, { reasonCode: 'RESUME_REQUIRED' })).toBe('Resume Required');
    expect(getApplyHref({ id: 'candidate-1' }, { reasonCode: 'RESUME_REQUIRED' }, 'frontend-engineer')).toBe('/jobs/frontend-engineer/apply');
  });
});
