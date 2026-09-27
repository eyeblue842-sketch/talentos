import { fireEvent, render, screen } from '@testing-library/react';
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
            openingSummary: 'Build reliable hiring workflows for enterprise recruiters.',
            keyResponsibilities: ['Design application services', 'Collaborate with product teams'],
            requiredQualifications: ['Java', 'AWS'],
            preferredQualifications: ['Kafka'],
            assumptions: [],
            missingFields: [],
          },
        },
      }),
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

  async function fillEssentials() {
    fireEvent.change(screen.getByLabelText(/Designation \/ job title/i), { target: { value: 'Senior Java Developer' } });
    fireEvent.change(screen.getByLabelText(/Minimum experience/i), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/Maximum experience/i), { target: { value: '8' } });
    fireEvent.change(screen.getByPlaceholderText('10'), { target: { value: '18' } });
    fireEvent.change(screen.getByPlaceholderText('25'), { target: { value: '28' } });
    fireEvent.change(screen.getByLabelText(/Workplace/i), { target: { value: 'Remote' } });
    const skillsInput = screen.getByPlaceholderText(/Java, Spring Boot, AWS/i);
    fireEvent.change(skillsInput, { target: { value: 'Java' } });
    fireEvent.keyDown(skillsInput, { key: 'Enter' });
  }

  it('renders the staged AI-first posting flow with no standalone JD writing requirement first', () => {
    renderWizard();

    ['Job details', 'Candidate requirements', 'Job description', 'Screening questions', 'Preview & publish'].forEach((label, index) => {
      const button = screen.getAllByRole('button').find((item) => item.textContent?.includes(label) && item.textContent?.includes(`Stage ${index + 1}`));
      expect(button).toBeTruthy();
    });
    expect(screen.getByRole('heading', { name: /^Job details$/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^Job Description$/i })).not.toBeInTheDocument();
  });

  it('generates a complete editable job post from minimal recruiter inputs', async () => {
    renderWizard();
    await fillEssentials();

    fireEvent.click(screen.getByRole('button', { name: /Generate job post/i }));

    expect(await screen.findByRole('heading', { name: /Review the generated job post/i })).toBeInTheDocument();
    expect(screen.getByText('Build reliable hiring workflows for enterprise recruiters.')).toBeInTheDocument();
    expect(screen.getAllByText(/Careeriz preview/i)).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^Apply$/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Edit Opening summary/i }));
    expect(screen.getByLabelText(/Edit Opening summary/i)).toHaveValue('Build reliable hiring workflows for enterprise recruiters.');
    fireEvent.change(screen.getByLabelText(/Edit Opening summary/i), { target: { value: 'Edited summary.' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
    expect(screen.getByText('Edited summary.')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/intelligence/job', expect.objectContaining({ method: 'POST' }));
  });

  it('falls back to an editable manual template when AI generation fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, message: 'AI unavailable' }),
    });
    renderWizard();
    await fillEssentials();

    fireEvent.click(screen.getByRole('button', { name: /Generate job post/i }));

    expect(await screen.findByText(/AI generation is unavailable right now/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual draft/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Edit About the role/i }));
    expect(screen.getByLabelText(/Edit About the role/i).value).toContain('Senior Java Developer');
    expect(screen.getAllByRole('button', { name: /^Continue$/i })[0]).toBeEnabled();
  });

  it('hides salary in preview and serialized payload when recruiter chooses Hide salary', async () => {
    const { container } = renderWizard();
    await fillEssentials();
    fireEvent.click(screen.getByRole('button', { name: /Hide salary/i }));
    fireEvent.click(screen.getByRole('button', { name: /Generate job post/i }));

    expect(await screen.findAllByText(/Salary not disclosed/i)).not.toHaveLength(0);
    expect(container.querySelector('input[name="hideSalaryFromCandidates"]').value).toBe('on');
  });

  it('adds no screening questions automatically and supports selected templates plus skip publish', async () => {
    renderWizard();
    await fillEssentials();
    fireEvent.click(screen.getByRole('button', { name: /Generate job post/i }));
    await screen.findByRole('heading', { name: /Review the generated job post/i });

    fireEvent.click(screen.getAllByRole('button', { name: /^Continue$/i })[0]);
    expect(screen.getByText(/No screening questions selected/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Skip questions & publish/i }));
    expect(screen.getByText(/Questions:/i).parentElement).toHaveTextContent('Skipped');
  });

  it('does not invent required skills when the recruiter supplies fewer than three', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          assisted: {
            openingSummary: 'Build reliable Java services.',
            roleOverview: 'This Senior Java Developer role builds backend services for enterprise recruiters. The developer will work with confirmed Java skills to deliver reliable workflows.',
            keyResponsibilities: ['Design application services'],
            requiredQualifications: ['Java', 'Kubernetes', 'GraphQL'],
            preferredQualifications: ['Kafka'],
            assumptions: [],
            missingFields: ['Recruiter provided fewer than three required skills.'],
          },
        },
      }),
    });
    const { container } = renderWizard();
    await fillEssentials();
    fireEvent.click(screen.getByRole('button', { name: /Generate job post/i }));
    await screen.findByRole('heading', { name: /Review the generated job post/i });

    expect(container.querySelector('input[name="skillsRequired"]').value).toBe('Java');
  });

  it('does not serialize internal assumptions, warnings, missing fields, or interview focus as public job content', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          assisted: {
            openingSummary: 'Opening summary for candidates.',
            roleOverview: 'This Senior Java Developer role builds services for recruiter workflows. The developer will deliver reliable backend features with the confirmed Java stack.',
            keyResponsibilities: ['Design Java application services'],
            requiredQualifications: ['Java'],
            preferredQualifications: [],
            assumptions: ['Internal assumption must stay private.'],
            exclusionaryWordingWarnings: ['Internal warning must stay private.'],
            missingFields: ['Internal missing field must stay private.'],
            interviewFocus: ['Internal interview focus must stay private.'],
          },
        },
      }),
    });
    const { container } = renderWizard();
    await fillEssentials();
    fireEvent.click(screen.getByRole('button', { name: /Generate job post/i }));
    await screen.findByRole('heading', { name: /Review the generated job post/i });

    const publicPayload = [
      container.querySelector('input[name="description"]').value,
      container.querySelector('input[name="responsibilities"]').value,
      container.querySelector('input[name="requirements"]').value,
      container.querySelector('input[name="preferredCandidateProfileJson"]').value,
    ].join('\n');

    expect(container.querySelector('input[name="preferredCandidateProfileJson"]').value).toBe('{}');
    expect(publicPayload).not.toContain('Internal assumption');
    expect(publicPayload).not.toContain('Internal warning');
    expect(publicPayload).not.toContain('Internal missing field');
    expect(publicPayload).not.toContain('Internal interview focus');
  });

  it('keeps opening summary and About the role separately editable in preview', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          assisted: {
            openingSummary: 'Opening summary for candidates.',
            roleOverview: 'This Senior Java Developer role builds services for recruiter workflows. The developer will deliver reliable backend features with the confirmed stack.',
            keyResponsibilities: ['Design application services'],
            requiredQualifications: ['Java'],
            preferredQualifications: [],
            assumptions: [],
            missingFields: [],
          },
        },
      }),
    });
    renderWizard();
    await fillEssentials();
    fireEvent.click(screen.getByRole('button', { name: /Generate job post/i }));
    await screen.findByRole('heading', { name: /Review the generated job post/i });

    expect(screen.getByText('Opening summary for candidates.')).toBeInTheDocument();
    expect(screen.getByText(/This Senior Java Developer role builds services/i)).toBeInTheDocument();
  });

  it('serializes essentials, generated text, structured qualifications, and questions into hidden fields', async () => {
    const { container } = renderWizard();
    await fillEssentials();
    fireEvent.click(screen.getByRole('button', { name: /Generate job post/i }));
    await screen.findByRole('heading', { name: /Review the generated job post/i });
    fireEvent.click(screen.getAllByRole('button', { name: /^Continue$/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /current annual CTC/i }));

    function hiddenValue(name) {
      return container.querySelector(`input[name="${name}"]`).value;
    }

    expect(hiddenValue('title')).toBe('Senior Java Developer');
    expect(hiddenValue('description')).toContain('Build reliable hiring workflows');
    expect(hiddenValue('responsibilities')).toContain('Design application services');
    expect(hiddenValue('skillsRequired')).toBe('Java');
    expect(JSON.parse(hiddenValue('candidateQualificationsJson'))).toMatchObject({
      minimumQualification: 'any',
      shiftTiming: 'GENERAL_DAY',
    });
    expect(hiddenValue('screeningQuestionText')).toBe('What is your current annual CTC?');
  });

  it('exposes every supported searchable dropdown option and serializes selections', async () => {
    const { container } = renderWizard();

    const choose = (label, option) => {
      const input = screen.getByRole('combobox', { name: label });
      fireEvent.focus(input);
      expect(screen.getByRole('option', { name: option })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('option', { name: option }));
    };

    const workplace = screen.getByRole('combobox', { name: 'Workplace' });
    fireEvent.focus(workplace);
    expect(screen.getAllByRole('option').map((item) => item.textContent)).toEqual(expect.arrayContaining(['On-site', 'Hybrid', 'Remote']));
    fireEvent.keyDown(workplace, { key: 'ArrowDown' });
    fireEvent.keyDown(workplace, { key: 'Enter' });
    choose('Employment type', 'Contract');
    choose('Shift timing', 'Night');
    choose('Education level', 'PG Qualification');
    choose('Degree', 'MBA');

    expect(container.querySelector('input[name="workplaceType"]').value).toBe('HYBRID');
    expect(container.querySelector('input[name="employmentType"]').value).toBe('CONTRACT');
    expect(container.querySelector('input[name="shiftTimingDisplay"]').value).toBe('NIGHT');
    expect(container.querySelector('input[name="educationLevelDisplay"]').value).toBe('pg');
    expect(container.querySelector('input[name="educationCourse"]').value).toBe('MBA');

    await fillEssentials();
    fireEvent.click(screen.getByRole('button', { name: /Generate job post/i }));
    await screen.findByRole('heading', { name: /Review the generated job post/i });
    fireEvent.click(screen.getAllByRole('button', { name: /^Continue$/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Add custom question/i }));
    const answerType = screen.getByRole('combobox', { name: 'Answer type' });
    fireEvent.focus(answerType);
    expect(screen.getAllByRole('option').map((item) => item.textContent)).toEqual(expect.arrayContaining(['Yes / No', 'Single select', 'Multi-select', 'Number', 'Short text', 'Long text']));
    fireEvent.click(screen.getByRole('option', { name: 'Multi-select' }));
    expect(answerType).toHaveValue('Multi-select');
  });
});
