import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecruiterJobPostWizard } from '../recruiter-job-post-wizard';

describe('RecruiterJobPostWizard', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          assisted: {
            summary: 'Lead backend delivery for a cloud-native product team.',
            responsibilities: ['Design APIs', 'Own AWS deployments'],
            requiredSkills: ['Java', 'AWS'],
            preferredSkills: ['Kafka'],
            assumptions: ['Salary is recruiter confirmed.'],
            missingFields: [],
          },
        },
      }),
    });
  });

  it('shows an editable application notification email default', () => {
    render(
      <RecruiterJobPostWizard
        organisationName="Northstar Talent Labs"
        organisationAbout="Product engineering partner"
        assignees={[]}
        requisitions={[]}
        recruiterEmail="owner@northstar.example"
        createAction={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Communication Preferences/i }));
    expect(screen.getByLabelText(/Application notification email/i)).toHaveValue('owner@northstar.example');
  });

  it('generates and applies AI job description content inline', async () => {
    render(
      <RecruiterJobPostWizard
        organisationName="Northstar Talent Labs"
        organisationAbout="Product engineering partner"
        assignees={[]}
        requisitions={[]}
        recruiterEmail="owner@northstar.example"
        createAction={() => {}}
      />
    );

    fireEvent.change(screen.getByLabelText(/Job title/i), { target: { value: 'Senior Java Developer' } });
    fireEvent.click(screen.getByRole('button', { name: /Job Description/i }));
    fireEvent.click(screen.getByRole('button', { name: /Generate with AI/i }));

    expect(await screen.findByText(/AI-generated draft/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Apply generated content/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Job summary/i)).toHaveValue('Lead backend delivery for a cloud-native product team.');
    });
  });

  function renderWizard() {
    return render(
      <RecruiterJobPostWizard
        organisationName="Northstar Talent Labs"
        organisationAbout="Product engineering partner"
        assignees={[]}
        requisitions={[]}
        recruiterEmail="owner@northstar.example"
        createAction={() => {}}
      />
    );
  }

  it('removes Candidate Preferences as a standalone step and renumbers the remaining steps 1-5', () => {
    renderWizard();
    expect(screen.queryByText(/Candidate Preferences/i)).not.toBeInTheDocument();

    const stepButtons = [
      'Job Details',
      'Screening Questions',
      'Job Description',
      'Communication Preferences',
      'Review & Publish',
    ].map((label) => screen.getByRole('button', { name: new RegExp(label, 'i') }));

    stepButtons.forEach((button, index) => {
      expect(button).toHaveTextContent(String(index + 1));
    });
  });

  it('Add Skills accepts a typed skill, prevents case-insensitive duplicates, and removes a chip', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /Job Description/i }));

    // All steps stay mounted (hidden via CSS, not unmounted - see the
    // wizard's own comment), so Review & Publish's read-only skill-summary
    // chip for "Java" also exists in the DOM at the same time as the
    // interactive Add Skills chip once a skill is added. The interactive
    // chip is the only one with a "Remove <skill>" button, so that's the
    // unambiguous way to assert on it specifically.
    const input = screen.getByPlaceholderText(/Java, Spring Boot, AWS/i);
    fireEvent.change(input, { target: { value: 'Java' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Remove Java' })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'JAVA' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getAllByRole('button', { name: /^Remove java$/i })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Java' }));
    expect(screen.queryByRole('button', { name: /^Remove java$/i })).not.toBeInTheDocument();
  });

  it('Candidate Qualifications box relocates minimum/maximum experience into the Job Description step', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /Job Description/i }));

    expect(screen.getByRole('heading', { name: 'Candidate Qualifications' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Minimum experience \(years\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Maximum experience \(years\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Department \/ functional area/i)).toBeInTheDocument();
  });

  it('Preferred Candidate Profile is closed by default, is keyboard/ARIA accessible, and preserves values when collapsed', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /Job Description/i }));

    const toggle = screen.getByRole('button', { name: /Preferred Candidate Profile/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const notesField = screen.getByPlaceholderText(/Any other preference that helps recruiters/i);
    fireEvent.change(notesField, { target: { value: 'Prefers hybrid-savvy candidates.' } });

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(screen.getByPlaceholderText(/Any other preference that helps recruiters/i)).toHaveValue('Prefers hybrid-savvy candidates.');
  });

  it('Recruiter owner (and Hiring manager, Approved requisition) render through the width-safe Select component, containing long option text instead of overflowing', () => {
    render(
      <RecruiterJobPostWizard
        organisationName="Northstar Talent Labs"
        organisationAbout="Product engineering partner"
        assignees={[{ id: 'member-1', userId: 'user-1', role: 'RECRUITER', user: { email: 'a-very-long-recruiter-owner-email-address@northstar-talent-labs.example.com' } }]}
        requisitions={[{ id: 'req-1', requisitionCode: 'REQ-1001', title: 'Senior Java Developer' }]}
        recruiterEmail="owner@northstar.example"
        createAction={() => {}}
      />
    );

    [/Recruiter owner/i, /Hiring manager/i, /Approved requisition/i].forEach((label) => {
      const select = screen.getByLabelText(label);
      expect(select.tagName).toBe('SELECT');
      expect(select.className).toMatch(/\bw-full\b/);
      expect(select.className).toMatch(/\bmin-w-0\b/);
      expect(select.className).toMatch(/\btruncate\b/);
    });
  });

  it('Job Location required-ness follows Workplace, without clearing an existing selection', async () => {
    renderWizard();

    // Review & Publish's read-only location summary chip also renders the
    // same text once selected (steps stay mounted), so assert on the
    // interactive selection chip specifically via its "Remove <location>"
    // accessible name rather than plain text.
    fireEvent.click(screen.getByRole('button', { name: /Search and select one or more job locations/i }));
    fireEvent.change(screen.getByPlaceholderText(/Search city, district or state/i), { target: { value: 'Bengaluru Urban' } });
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Bengaluru Urban' }));
    expect(screen.getByRole('button', { name: 'Remove Bengaluru Urban' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Workplace/i), { target: { value: 'REMOTE' } });
    // Selection must survive a Workplace change even though it's no longer required.
    expect(screen.getByRole('button', { name: 'Remove Bengaluru Urban' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Workplace/i), { target: { value: 'ONSITE' } });
    expect(screen.getByRole('button', { name: 'Remove Bengaluru Urban' })).toBeInTheDocument();
  });

  it('blocks submission with an inline error when an on-site job has no location selected', () => {
    const { container } = renderWizard();
    fireEvent.change(screen.getByLabelText(/Job title/i), { target: { value: 'Senior Java Developer' } });
    fireEvent.change(screen.getByLabelText(/Workplace/i), { target: { value: 'ONSITE' } });

    const form = container.querySelector('form');
    fireEvent.submit(form);

    expect(screen.getByText(/Add at least one job location for on-site or hybrid roles\./i)).toBeInTheDocument();
    // Submission is redirected back to the step containing the error.
    expect(screen.getByRole('heading', { name: 'Job Details' })).toBeInTheDocument();
  });

  it('preserves entered values when navigating Previous/Next between steps', () => {
    renderWizard();
    fireEvent.change(screen.getByLabelText(/Job title/i), { target: { value: 'Staff Engineer' } });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

    expect(screen.getByLabelText(/Job title/i)).toHaveValue('Staff Engineer');
  });

  it('Candidate Qualifications values persist across step navigation (steps stay mounted, not unmounted)', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /Job Description/i }));
    fireEvent.change(screen.getByLabelText(/Minimum experience \(years\)/i), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/Minimum qualification/i), { target: { value: 'pg' } });

    fireEvent.click(screen.getByRole('button', { name: /Job Details/i }));
    fireEvent.click(screen.getByRole('button', { name: /Job Description/i }));

    expect(screen.getByLabelText(/Minimum experience \(years\)/i)).toHaveValue(3);
    expect(screen.getByLabelText(/Minimum qualification/i)).toHaveValue('pg');
  });

  it('Review & Publish still offers Save Draft and Publish Job actions', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /Review & Publish/i }));
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish Job' })).toBeInTheDocument();
  });

  it('serializes candidateQualifications/preferredCandidateProfile/locations as JSON hidden fields, and skillsRequired as a comma-joined list', () => {
    // Inspects the hidden inputs' own values directly rather than relying
    // on createAction actually being invoked: jsdom's SubmitEvent doesn't
    // reliably set `.submitter` for a name/value submit button (Save
    // Draft/Publish Job both carry name="status"), which React's <form
    // action={fn}> dispatch needs to include that button's pair in
    // FormData - a jsdom/React-19-forms interoperability gap, not
    // something this component controls. The hidden fields' values are
    // exactly what actually gets submitted either way.
    const { container } = renderWizard();

    fireEvent.change(screen.getByLabelText(/Job title/i), { target: { value: 'Senior Java Developer' } });
    fireEvent.change(screen.getByLabelText(/Job summary/i), { target: { value: 'A role building resilient platform services for our growing product team.' } });
    fireEvent.change(screen.getByLabelText(/Workplace/i), { target: { value: 'REMOTE' } });

    fireEvent.click(screen.getByRole('button', { name: /Job Description/i }));
    const skillsInput = screen.getByPlaceholderText(/Java, Spring Boot, AWS/i);
    fireEvent.change(skillsInput, { target: { value: 'Java' } });
    fireEvent.keyDown(skillsInput, { key: 'Enter' });
    fireEvent.change(screen.getByLabelText(/^Industry$/i), { target: { value: 'Software Product' } });

    fireEvent.click(screen.getByRole('button', { name: /Preferred Candidate Profile/i }));
    fireEvent.change(screen.getByLabelText(/^Preferred industry$/i), { target: { value: 'Software Product' } });

    function hiddenValue(name) {
      return container.querySelector(`input[name="${name}"]`).value;
    }

    expect(hiddenValue('skillsRequired')).toBe('Java');
    expect(JSON.parse(hiddenValue('candidateQualificationsJson'))).toMatchObject({ industry: 'Software Product' });
    expect(JSON.parse(hiddenValue('preferredCandidateProfileJson'))).toMatchObject({ preferredIndustry: 'Software Product' });
    expect(JSON.parse(hiddenValue('locationsJson'))).toEqual([]);
  });
});
