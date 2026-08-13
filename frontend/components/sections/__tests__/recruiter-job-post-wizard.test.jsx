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
});
