import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { EmployerAccessCards } from './employer-access-cards';

describe('EmployerAccessCards', () => {
  it('renders both Consultancy Recruiter and Company Recruiter cards with Log in / Create account actions', () => {
    render(<EmployerAccessCards />);

    expect(screen.getByRole('heading', { name: 'Consultancy Recruiter' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Company Recruiter' })).toBeInTheDocument();

    const loginLinks = screen.getAllByRole('link', { name: 'Log in' });
    const createLinks = screen.getAllByRole('link', { name: 'Create account' });
    expect(loginLinks).toHaveLength(2);
    expect(createLinks).toHaveLength(2);
  });

  it('carries the selected employer type into the login and register links', () => {
    render(<EmployerAccessCards />);

    const consultancyLogin = screen.getAllByRole('link', { name: 'Log in' })[0];
    const companyLogin = screen.getAllByRole('link', { name: 'Log in' })[1];
    expect(consultancyLogin).toHaveAttribute('href', expect.stringContaining('employerType=CONSULTANCY'));
    expect(companyLogin).toHaveAttribute('href', expect.stringContaining('employerType=COMPANY'));

    const consultancyRegister = screen.getAllByRole('link', { name: 'Create account' })[0];
    const companyRegister = screen.getAllByRole('link', { name: 'Create account' })[1];
    expect(consultancyRegister).toHaveAttribute('href', expect.stringContaining('/hire/register'));
    expect(consultancyRegister).toHaveAttribute('href', expect.stringContaining('employerType=CONSULTANCY'));
    expect(companyRegister).toHaveAttribute('href', expect.stringContaining('/hire/register'));
    expect(companyRegister).toHaveAttribute('href', expect.stringContaining('employerType=COMPANY'));
  });

  it('never states or implies that Consultancy accounts are inferior, and states pricing/features are identical', () => {
    render(<EmployerAccessCards />);

    expect(screen.getByText(/same careeriz subscription plans and job-posting benefits/i)).toBeInTheDocument();
    expect(screen.queryByText(/inferior/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/downgrade/i)).not.toBeInTheDocument();
  });

  it('explains that Company Recruiter requires a verified official company email address', () => {
    render(<EmployerAccessCards />);

    expect(
      screen.getAllByText(/verified official company email address/i).length,
    ).toBeGreaterThan(0);
  });

  it('preserves incoming search params (e.g. next) on both card actions', () => {
    render(<EmployerAccessCards searchParams={{ next: '/recruiter/jobs' }} />);

    const consultancyRegister = screen.getAllByRole('link', { name: 'Create account' })[0];
    expect(consultancyRegister).toHaveAttribute('href', expect.stringContaining('next=%2Frecruiter%2Fjobs'));
  });

  it('has no obvious accessibility violations', async () => {
    const { container } = render(<EmployerAccessCards />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
