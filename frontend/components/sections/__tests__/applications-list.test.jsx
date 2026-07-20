import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { ApplicationsList } from '../applications-list';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

describe('ApplicationsList', () => {
  test('renders application links, references, and latest updates', () => {
    render(
      <ApplicationsList
        applications={[{
          id: 'application-1',
          role: 'Frontend Engineer',
          company: 'Acme Labs',
          location: 'Bengaluru',
          summary: 'Reference APP-42',
          latestUpdate: 'Interview scheduled for Monday.',
          reference: 'APP-42',
          href: '/candidate/applications/application-1',
          tone: 'brand',
          status: 'Interview scheduled',
          stage: 'INTERVIEW_SCHEDULED',
          date: '7/17/2026',
        }]}
      />,
    );

    expect(screen.getByText('Frontend Engineer')).toBeInTheDocument();
    expect(screen.getByText('Interview scheduled for Monday.')).toBeInTheDocument();
    expect(screen.getByText('Ref APP-42')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View application' })).toHaveAttribute('href', '/candidate/applications/application-1');
    expect(screen.getByText('INTERVIEW SCHEDULED')).toBeInTheDocument();
  });
});
