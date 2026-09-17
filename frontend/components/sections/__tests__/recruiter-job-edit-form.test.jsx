import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RecruiterJobEditForm } from '../recruiter-job-edit-form';

const baseJob = {
  id: 'job-1',
  title: 'Senior Java Developer',
  description: 'Own backend delivery for our platform team.',
  status: 'OPEN',
  location: 'Bengaluru Urban, Karnataka',
  locations: [{ id: 'Bengaluru Urban, Karnataka', name: 'Bengaluru Urban, Karnataka', city: 'Bengaluru Urban', state: 'Karnataka' }],
  employmentType: 'FULL_TIME',
  workplaceType: 'ONSITE',
  experienceMin: 3,
  experienceMax: 6,
  salaryMin: 12,
  salaryMax: 20,
  currency: 'INR',
  numberOfOpenings: 1,
  department: 'Engineering',
  businessUnit: '',
  skillsRequired: ['Java', 'Spring Boot'],
  candidateQualifications: {
    minimumQualification: 'ug',
    industry: 'IT Services & Consulting',
    certifications: ['AWS Certified Solutions Architect'],
  },
  preferredCandidateProfile: {
    preferredIndustry: 'Software Product',
    willingToRelocate: 'FLEXIBLE',
  },
  isPublic: true,
  publicSalaryEnabled: true,
  featuredInPortal: false,
  autoCloseOnTargetHire: false,
  recruiter: { id: 'user-1', email: 'recruiter@northstar.example' },
  hiringManager: null,
  requisition: null,
  responsibilities: ['Design backend services', 'Mentor engineers'],
  benefits: ['Health insurance', 'Flexible working'],
  requirements: ['Graduate', 'Relevant domain experience'],
  applicationNotificationEmail: 'recruiter@northstar.example',
};

describe('RecruiterJobEditForm', () => {
  it('pre-fills skills, candidate qualifications, and preferred candidate profile from the existing job', () => {
    render(<RecruiterJobEditForm job={baseJob} assignees={[]} requisitions={[]} updateJobAction={() => {}} />);

    expect(screen.getByText('Java')).toBeInTheDocument();
    expect(screen.getByText('Spring Boot')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Industry$/i)).toHaveValue('IT Services & Consulting');
    expect(screen.getByText('AWS Certified Solutions Architect')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Preferred Candidate Profile/i }));
    expect(screen.getByLabelText(/Preferred industry/i)).toHaveValue('Software Product');
    expect(screen.getByLabelText(/Willingness to relocate/i)).toHaveValue('FLEXIBLE');
  });

  it('derives the job location chip from job.locations when present', () => {
    render(<RecruiterJobEditForm job={baseJob} assignees={[]} requisitions={[]} updateJobAction={() => {}} />);
    expect(screen.getByText('Bengaluru Urban')).toBeInTheDocument();
  });

  it('does not crash on a legacy job with no locations/candidateQualifications/preferredCandidateProfile, and falls back to job.location', () => {
    const legacyJob = {
      ...baseJob,
      locations: undefined,
      candidateQualifications: null,
      preferredCandidateProfile: null,
    };

    render(<RecruiterJobEditForm job={legacyJob} assignees={[]} requisitions={[]} updateJobAction={() => {}} />);
    expect(screen.getByText('Bengaluru Urban')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Industry$/i)).toHaveValue('');
  });

  it('serializes the updated candidateQualifications/preferredCandidateProfile/locations as JSON hidden fields, without clobbering unedited data', () => {
    // Inspects the hidden inputs' own values directly rather than relying
    // on updateJobAction being invoked via a real submit dispatch - see the
    // equivalent note in recruiter-job-post-wizard.test.jsx.
    const { container } = render(
      <RecruiterJobEditForm job={baseJob} assignees={[]} requisitions={[]} updateJobAction={() => {}} />
    );

    function hiddenValue(name) {
      return container.querySelector(`input[name="${name}"]`).value;
    }

    expect(hiddenValue('skillsRequired')).toBe('Java, Spring Boot');
    expect(JSON.parse(hiddenValue('candidateQualificationsJson'))).toMatchObject({
      industry: 'IT Services & Consulting',
      certifications: ['AWS Certified Solutions Architect'],
    });
    expect(JSON.parse(hiddenValue('preferredCandidateProfileJson'))).toMatchObject({
      preferredIndustry: 'Software Product',
    });
    expect(JSON.parse(hiddenValue('locationsJson'))).toEqual([
      { id: 'Bengaluru Urban, Karnataka', name: 'Bengaluru Urban, Karnataka', city: 'Bengaluru Urban', state: 'Karnataka' },
    ]);
  });

  it('carries responsibilities, benefits, legacy requirements, and applicationNotificationEmail through so saving never wipes them', () => {
    const { container } = render(
      <RecruiterJobEditForm job={baseJob} assignees={[]} requisitions={[]} updateJobAction={() => {}} />
    );

    expect(screen.getByLabelText(/Key responsibilities/i)).toHaveValue('Design backend services\nMentor engineers');
    expect(screen.getByLabelText(/Perks & benefits/i)).toHaveValue('Health insurance\nFlexible working');
    // The saved primary recipient is preserved through the ApplicationRecipients
    // control even when the members list has not loaded, so saving never wipes it.
    expect(container.querySelector('input[name="applicationNotificationEmail"]').value).toBe('recruiter@northstar.example');
    expect(container.querySelector('input[name="requirements"]').value).toBe('Graduate\nRelevant domain experience');
  });

  it('renders Recruiter owner, Hiring manager, and Approved requisition through the width-safe Select component (no overflow regression)', () => {
    const assignees = [
      { id: 'member-1', userId: 'user-1', role: 'RECRUITER', user: { email: 'a-very-long-recruiter-owner-email-address@northstar-talent-labs.example.com' } },
    ];
    render(<RecruiterJobEditForm job={baseJob} assignees={assignees} requisitions={[]} updateJobAction={() => {}} />);

    const recruiterOwnerSelect = screen.getByLabelText(/Recruiter owner/i);
    expect(recruiterOwnerSelect.tagName).toBe('SELECT');
    expect(recruiterOwnerSelect.className).toMatch(/\bw-full\b/);
    expect(recruiterOwnerSelect.className).toMatch(/\bmin-w-0\b/);
    expect(recruiterOwnerSelect.className).toMatch(/\btruncate\b/);
  });
});
