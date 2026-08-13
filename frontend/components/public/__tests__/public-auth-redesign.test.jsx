import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AuthExperience } from '@/components/auth/auth-experience';
import { PublicHeader } from '@/components/public/public-header';
import { PublicJobSearchForm } from '@/components/sections/public-job-search-form';
import { getLegacyAuthDestination } from '@/lib/auth-experience';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

describe('public landing and authentication redesign', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
    delete window.location;
    window.location = { assign: vi.fn() };
  });

  test('public header displays candidate and employer entry actions', () => {
    render(<PublicHeader />);

    expect(screen.getByRole('link', { name: 'Careeriz Jobs' })).toHaveAttribute('href', '/candidate');
    expect(screen.getByRole('link', { name: 'Careeriz Hire' })).toHaveAttribute('href', '/hire');
    expect(screen.getByRole('link', { name: 'Companies' })).toHaveAttribute('href', '/companies');
    expect(screen.queryByRole('link', { name: 'Jobs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Career Tools' })).not.toBeInTheDocument();
  });

  test('desktop header keeps only the simplified product navigation', () => {
    render(<PublicHeader />);

    expect(screen.getByRole('link', { name: 'Careeriz Jobs' })).toHaveAttribute('href', '/candidate');
    expect(screen.getByRole('link', { name: 'Careeriz Hire' })).toHaveAttribute('href', '/hire');
    expect(screen.queryByRole('link', { name: /explore products/i })).not.toBeInTheDocument();
  });

  test('mobile navigation is accessible', async () => {
    render(<PublicHeader />);

    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
    expect(screen.getAllByRole('link', { name: 'Careeriz Hire' }).some((link) => link.getAttribute('href') === '/hire')).toBe(true);
    expect(screen.getAllByRole('link', { name: 'Companies' }).length).toBeGreaterThan(0);

    expect((await axe(document.body)).violations).toHaveLength(0);
  });

  test('candidate login does not display recruiter registration', () => {
    render(
      <AuthExperience
        audience="candidate"
        mode="login"
        providers={{ googleVisible: true, linkedinConfigured: false }}
      />,
    );

    expect(screen.getAllByRole('heading', { name: /welcome back to your career journey/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/create employer account/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/create employer workspace\/account/i)).not.toBeInTheDocument();
  });

  test('employer login does not display candidate registration', () => {
    render(<AuthExperience audience="employer" mode="login" />);

    expect(screen.getByRole('heading', { name: /welcome back to careeriz hire/i })).toBeInTheDocument();
    expect(screen.queryByText(/create a candidate profile/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/create profile/i)).not.toBeInTheDocument();
  });

  test('candidate authentication routes still use candidate role routing', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { user: { role: 'CANDIDATE' } } }),
    });

    render(<AuthExperience audience="candidate" mode="login" />);

    fireEvent.change(screen.getAllByLabelText('Email')[0], { target: { value: 'candidate@example.com' } });
    fireEvent.change(screen.getAllByLabelText('Password')[0], { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(window.location.assign).toHaveBeenCalledWith('/candidate/dashboard');
    });
  });

  test('employer authentication routes still use recruiter role routing', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { user: { role: 'RECRUITER' } } }),
    });

    render(<AuthExperience audience="employer" mode="login" />);

    fireEvent.change(screen.getAllByLabelText('Work email')[0], { target: { value: 'team@company.com' } });
    fireEvent.change(screen.getAllByLabelText('Password')[0], { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(window.location.assign).toHaveBeenCalledWith('/recruiter/home');
    });
  });

  test('social login is hidden when not configured', () => {
    render(
      <AuthExperience
        audience="candidate"
        mode="login"
        providers={{ googleVisible: true, linkedinConfigured: false }}
      />,
    );

    expect(screen.getByText(/continue with google/i)).toBeInTheDocument();
    expect(screen.queryByText(/continue with linkedin/i)).not.toBeInTheDocument();
  });

  test('hero search keeps the initial opening experience compact', () => {
    render(<PublicJobSearchForm variant="hero" />);

    expect(screen.getByLabelText('Job title or skills')).toHaveAttribute('name', 'keyword');
    expect(screen.getByLabelText('Select experience')).toHaveAttribute('name', 'minExperience');
    expect(screen.getByLabelText('Choose location')).toHaveAttribute('name', 'location');
    expect(screen.getByRole('button', { name: /search jobs/i })).toBeInTheDocument();
    expect(screen.queryByText(/employment type/i)).not.toBeInTheDocument();
    expect(document.querySelector('input[name="fresherFriendly"]')).toBeNull();
  });

  test('legacy auth compatibility routes recruiter hints and ambiguous callback states safely', () => {
    expect(getLegacyAuthDestination({ next: '/recruiter/jobs' })).toEqual({
      type: 'redirect',
      href: '/hire/login?next=%2Frecruiter%2Fjobs',
    });

    expect(getLegacyAuthDestination({ authStatus: 'password-reset-ready' })).toEqual({
      type: 'chooser',
    });
  });
});
