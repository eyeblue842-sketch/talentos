import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CandidateProfileForm } from '../candidate-profile-form';

const submitCandidateProfileFormActionMock = vi.fn(async () => ({ status: 'success', message: 'Saved', fieldErrors: {} }));
const routerRefreshMock = vi.fn();
const createObjectUrlMock = vi.fn(() => 'blob:profile-photo-preview');
const revokeObjectUrlMock = vi.fn();

vi.mock('@/app/candidate/actions', () => ({
  submitCandidateProfileFormAction: (...args) => submitCandidateProfileFormActionMock(...args),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerRefreshMock }),
}));

function buildProfile(overrides = {}) {
  return {
    fullName: 'Jane Candidate',
    phoneNumber: '+91 9999999999',
    currentTitle: 'Frontend Engineer',
    headline: 'Building accessible product interfaces',
    location: 'Bengaluru, Karnataka, India',
    currentEmployer: 'Acme Labs',
    currentDesignation: 'Senior Engineer',
    totalExperience: 6,
    noticePeriodDays: 30,
    employmentStatus: 'EMPLOYED',
    lastWorkingDate: null,
    skills: ['React', 'Next.js', 'Accessibility'],
    preferredRoles: ['Frontend Engineer'],
    preferredLocations: ['Bengaluru', 'Remote'],
    currentCtcLpa: 18,
    expectedCtcLpa: 24,
    availability: 'ONE_MONTH',
    profileVisibility: 'RECRUITERS_ONLY',
    workplacePreferences: ['REMOTE'],
    employmentPreferences: ['FULL_TIME'],
    summary: 'I build web applications for high-growth teams.',
    portfolioUrl: 'https://portfolio.example.com',
    linkedInUrl: 'https://linkedin.com/in/jane',
    githubUrl: 'https://github.com/jane',
    profileImageUrl: 'https://images.example.com/jane.png',
    experienceEntries: [{
      company: 'Acme Labs',
      title: 'Frontend Engineer',
      startDate: '2022-01',
      endDate: '',
      currentlyWorking: true,
      location: 'Remote',
      technologies: ['React', 'TypeScript'],
      summary: 'Built candidate-facing product experiences.',
    }],
    educationEntries: [{
      degree: 'B.Tech',
      institution: 'VTU',
      fieldOfStudy: 'Computer Science',
      startYear: '2014',
      endYear: '2018',
      score: '8.6',
    }],
    certificationEntries: [{
      name: 'AWS Certified Developer - Associate',
      issuingOrganisation: 'AWS',
      issueDate: '2024-06',
      expiryDate: '',
      credentialUrl: '',
      credentialId: '',
    }],
    languageEntries: [{
      language: 'English',
      proficiency: 'Fluent',
      read: false,
      write: false,
      speak: true,
    }],
    projectEntries: [{
      projectName: 'Candidate Hub',
      role: 'Lead Engineer',
      company: 'Acme Labs',
      duration: '6 months',
      domain: 'Recruiting',
      technologies: ['React', 'Node.js'],
      summary: 'Delivered the candidate workspace.',
    }],
    searchableProfile: true,
    phoneVisibleToRecruiters: false,
    salaryVisibleToRecruiters: false,
    resumeVisibleToRecruiters: true,
    ...overrides,
  };
}

function clickSectionAction(headingName, buttonName = 'Edit') {
  const heading = screen.getByRole('heading', { name: headingName });
  const card = heading.closest('div.rounded-\\[32px\\]') || heading.closest('[class*="rounded-[32px]"]') || heading.parentElement?.parentElement;
  fireEvent.click(within(card).getAllByRole('button', { name: buttonName })[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  submitCandidateProfileFormActionMock.mockReset();
  submitCandidateProfileFormActionMock.mockResolvedValue({ status: 'success', message: 'Saved', fieldErrors: {} });
  routerRefreshMock.mockReset();
  global.URL.createObjectURL = createObjectUrlMock;
  global.URL.revokeObjectURL = revokeObjectUrlMock;
});

afterEach(() => {
  cleanup();
});

describe('CandidateProfileForm', () => {
  test('renders display-first cards and reveals career profile fields only in edit mode', () => {
    render(<CandidateProfileForm profile={buildProfile()} />);

    expect(screen.queryByText(/json array/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/stored as structured json/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/portfolio links/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /career profile/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/preferred roles/i)).not.toBeInTheDocument();

    clickSectionAction(/career profile/i);

    expect(screen.getByLabelText(/preferred roles/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/preferred locations/i)).toBeInTheDocument();
    expect(screen.getAllByText(/expected annual ctc/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/^amount$/i)[0]).toBeInTheDocument();
    expect(screen.getByLabelText(/availability/i)).toBeInTheDocument();
  });

  test('resume headline card contains only the headline and profile summary appears immediately after it', () => {
    render(<CandidateProfileForm profile={buildProfile()} />);

    const resumeHeadline = screen.getByRole('heading', { name: /resume headline/i });
    const profileSummary = screen.getByRole('heading', { name: /profile summary/i });

    const resumeCard = resumeHeadline.closest('[class*="rounded-[32px]"]') || resumeHeadline.parentElement?.parentElement;
    expect(within(resumeCard).queryByText(/current title/i)).not.toBeInTheDocument();
    expect(within(resumeCard).getByText('Building accessible product interfaces')).toBeInTheDocument();

    expect(resumeHeadline.compareDocumentPosition(profileSummary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('language add and remove updates the serialized hidden field from the focused editor', () => {
    const { container } = render(<CandidateProfileForm profile={buildProfile({
      languageEntries: [{ language: 'English', proficiency: 'Fluent', read: false, write: false, speak: true }],
      experienceEntries: [],
      educationEntries: [],
      certificationEntries: [],
      projectEntries: [],
    })} />);

    const hiddenInput = container.querySelector('input[name="languageEntries"]');
    expect(hiddenInput.value).toContain('English');

    clickSectionAction(/personal details/i);

    fireEvent.click(screen.getByRole('button', { name: /^\+ add$/i }));
    const languageSelects = screen.getAllByLabelText(/language/i);
    const proficiencySelects = screen.getAllByLabelText(/proficiency/i);
    fireEvent.change(languageSelects[1], { target: { value: 'Hindi' } });
    fireEvent.change(proficiencySelects[1], { target: { value: 'Native / Bilingual' } });
    const readCheckboxes = screen.getAllByLabelText(/read/i);
    const writeCheckboxes = screen.getAllByLabelText(/write/i);
    const speakCheckboxes = screen.getAllByLabelText(/speak/i);
    fireEvent.click(readCheckboxes[1]);
    fireEvent.click(writeCheckboxes[1]);
    expect(speakCheckboxes[1]).toBeChecked();

    expect(hiddenInput.value).toContain('Hindi');
    expect(hiddenInput.value).toContain('Native / Bilingual');
    expect(hiddenInput.value).toContain('"read":true');
    expect(hiddenInput.value).toContain('"write":true');
    expect(hiddenInput.value).toContain('"speak":true');

    fireEvent.click(screen.getByRole('button', { name: /remove language hindi/i }));
    expect(hiddenInput.value).not.toContain('Hindi');
  });

  test('focused editors serialize structured entries through hidden inputs', () => {
    const { container } = render(<CandidateProfileForm profile={buildProfile({ experienceEntries: [], educationEntries: [], certificationEntries: [], projectEntries: [] })} />);

    clickSectionAction(/employment/i, /\+ add employment/i);
    fireEvent.click(screen.getAllByRole('button', { name: /\+ add employment/i }).at(-1));
    fireEvent.change(screen.getAllByLabelText(/company/i).at(-1), { target: { value: 'Orbit Systems' } });
    fireEvent.change(screen.getByLabelText(/job title \/ designation/i), { target: { value: 'Software Engineer' } });

    clickSectionAction(/education/i, /\+ add education/i);
    fireEvent.click(screen.getAllByRole('button', { name: /\+ add education/i }).at(-1));
    fireEvent.change(screen.getByLabelText(/degree/i), { target: { value: 'MBA' } });

    clickSectionAction(/certifications/i, /\+ add certification/i);
    fireEvent.click(screen.getAllByRole('button', { name: /\+ add certification/i }).at(-1));
    fireEvent.change(screen.getByLabelText(/certification name/i), { target: { value: 'PMP' } });

    clickSectionAction(/projects/i, /\+ add project/i);
    fireEvent.click(screen.getAllByRole('button', { name: /\+ add project/i }).at(-1));
    fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: 'Hiring Analytics' } });

    expect(container.querySelector('input[name="experienceEntries"]').value).toContain('Orbit Systems');
    expect(container.querySelector('input[name="educationEntries"]').value).toContain('MBA');
    expect(container.querySelector('input[name="certificationEntries"]').value).toContain('PMP');
    expect(container.querySelector('input[name="projectEntries"]').value).toContain('Hiring Analytics');
  });

  test('controlled snapshot editor opens with snapshot-only fields and closes on cancel', () => {
    const onActiveSectionChange = vi.fn();
    render(
      <CandidateProfileForm
        profile={buildProfile()}
        activeSection="profile-snapshot"
        onActiveSectionChange={onActiveSectionChange}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/current title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/current employer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/current designation/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/current location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/total experience/i)).toBeInTheDocument();
    expect(screen.getByText(/current annual ctc/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notice period \(days\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change photo/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/upload profile photo/i)).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
    expect(screen.queryByLabelText(/profile image url/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/preferred roles/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/certification name/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onActiveSectionChange).toHaveBeenCalledWith(null);
  });

  test('save success closes the dialog, refreshes the route, and keeps the updated value in the card', async () => {
    submitCandidateProfileFormActionMock.mockResolvedValueOnce({
      status: 'success',
      message: 'Saved',
      fieldErrors: {},
    });

    render(<CandidateProfileForm profile={buildProfile()} />);

    clickSectionAction(/resume headline/i);
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^resume headline$/i), { target: { value: 'Updated candidate headline' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(submitCandidateProfileFormActionMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(routerRefreshMock).toHaveBeenCalled();
    expect(screen.getByText('Updated candidate headline')).toBeInTheDocument();
  });

  test('save failure keeps the dialog open and shows the error state', async () => {
    submitCandidateProfileFormActionMock.mockResolvedValueOnce({
      status: 'error',
      message: 'Unable to save profile.',
      fieldErrors: {},
    });

    render(<CandidateProfileForm profile={buildProfile()} />);

    clickSectionAction(/resume headline/i);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(submitCandidateProfileFormActionMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Unable to save profile.')).toBeInTheDocument());
    expect(routerRefreshMock).not.toHaveBeenCalled();
  });

  test('candidate-friendly validation feedback keeps the career profile dialog open on validation failure', async () => {
    submitCandidateProfileFormActionMock.mockResolvedValueOnce({
      status: 'error',
      message: 'Enter a valid last working date.',
      fieldErrors: {
        lastWorkingDate: ['Enter a valid last working date.'],
        expectedCtcLpa: ['Expected annual CTC must be a valid annual package.'],
      },
    });

    render(<CandidateProfileForm profile={buildProfile({ lastWorkingDate: '2026-08-01' })} />);

    clickSectionAction(/career profile/i);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(submitCandidateProfileFormActionMock).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('save button shows pending state and prevents double submit while saving', async () => {
    let resolveAction;
    submitCandidateProfileFormActionMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveAction = resolve;
    }));

    render(<CandidateProfileForm profile={buildProfile()} />);

    clickSectionAction(/resume headline/i);
    const dialog = screen.getByRole('dialog');
    const saveButton = within(dialog).getByRole('button', { name: 'Save changes' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      const pendingButton = screen.getByText('Saving...').closest('button');
      expect(pendingButton).toBeDisabled();
    });
    fireEvent.click(screen.getByText('Saving...').closest('button'));
    expect(submitCandidateProfileFormActionMock).toHaveBeenCalledTimes(1);

    resolveAction({ status: 'success', message: 'Saved', fieldErrors: {} });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('expected annual CTC input keeps focus while typing', async () => {
    const user = userEvent.setup();
    render(<CandidateProfileForm profile={buildProfile()} />);

    clickSectionAction(/career profile/i);
    const amountInput = screen.getAllByLabelText(/^amount$/i)[0];
    await user.clear(amountInput);
    await user.type(amountInput, '25.5');

    expect(amountInput).toHaveValue(25.5);
    expect(amountInput).toHaveFocus();
  });

  test('skills input accepts commas during typing and preserves focus', async () => {
    const user = userEvent.setup();
    render(<CandidateProfileForm profile={buildProfile()} />);

    clickSectionAction(/key skills/i);
    const dialog = screen.getByRole('dialog');
    const skillsInput = within(dialog).getByLabelText(/^skills$/i);
    await user.clear(skillsInput);
    await user.type(skillsInput, 'Java, React, SQL, Azure');

    expect(skillsInput).toHaveValue('Java, React, SQL, Azure');
    expect(skillsInput).toHaveFocus();
  });

  test('skills input accepts pasted comma-separated values and serializes them for save', async () => {
    const { container } = render(<CandidateProfileForm profile={buildProfile()} />);

    clickSectionAction(/key skills/i);
    const dialog = screen.getByRole('dialog');
    const skillsInput = within(dialog).getByLabelText(/^skills$/i);
    fireEvent.change(skillsInput, { target: { value: 'Java,React, SQL,Azure' } });

    expect(skillsInput).toHaveValue('Java,React, SQL,Azure');
    expect(container.querySelector('input[name="skills"]').value).toBe('Java,React, SQL,Azure');
  });

  test('profile snapshot text input keeps focus while typing', async () => {
    const user = userEvent.setup();
    render(
      <CandidateProfileForm
        profile={buildProfile()}
        activeSection="profile-snapshot"
        onActiveSectionChange={() => {}}
      />,
    );
    const employerInput = screen.getByLabelText(/current employer/i);
    await user.clear(employerInput);
    await user.type(employerInput, 'TechAffinity Consulting');

    expect(employerInput).toHaveValue('TechAffinity Consulting');
    expect(employerInput).toHaveFocus();
  });

  test('employment editor retains focus while typing into repeatable fields', async () => {
    const user = userEvent.setup();
    render(<CandidateProfileForm profile={buildProfile()} />);

    clickSectionAction(/employment/i);
    const companyInput = screen.getByLabelText(/^company$/i);
    await user.clear(companyInput);
    await user.type(companyInput, 'Acme Delivery Labs');

    expect(companyInput).toHaveValue('Acme Delivery Labs');
    expect(companyInput).toHaveFocus();
  });

  test('selected profile photo renders a preview and remove returns to the fallback avatar', () => {
    render(
      <CandidateProfileForm
        profile={buildProfile({ profileImageUrl: null, fullName: 'Jane Candidate' })}
        activeSection="profile-snapshot"
        onActiveSectionChange={() => {}}
      />,
    );

    const fileInput = screen.getByLabelText(/upload profile photo/i);
    const file = new File(['photo'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(createObjectUrlMock).toHaveBeenCalledWith(file);
    expect(screen.getByAltText(/jane candidate profile photo preview/i)).toHaveAttribute('src', 'blob:profile-photo-preview');

    fireEvent.click(screen.getByRole('button', { name: /remove photo/i }));
    expect(screen.getByLabelText(/profile avatar fallback/i)).toHaveTextContent('JC');
  });

  test('unsupported or oversized profile photos show a validation error before save', () => {
    render(
      <CandidateProfileForm
        profile={buildProfile()}
        activeSection="profile-snapshot"
        onActiveSectionChange={() => {}}
      />,
    );

    const fileInput = screen.getByLabelText(/upload profile photo/i);
    const invalidFile = new File(['photo'], 'avatar.gif', { type: 'image/gif' });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });
    expect(screen.getByText('Please upload a JPG, PNG, or WebP image.')).toBeInTheDocument();

    const oversizedFile = new File([new Uint8Array((5 * 1024 * 1024) + 1)], 'avatar.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });
    expect(screen.getByText('Profile photo must be smaller than 5 MB.')).toBeInTheDocument();
  });
});
