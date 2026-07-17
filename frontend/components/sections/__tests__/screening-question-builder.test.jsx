import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, test, vi } from 'vitest';
import { ScreeningQuestionBuilder } from '../screening-question-builder';

const noop = vi.fn(async () => {});

function buildProps() {
  return {
    job: {
      id: 'job-1',
      screeningQuestions: [
        {
          id: 'question-1',
          questionText: 'Work authorisation',
          questionType: 'YES_NO',
          required: true,
          helpText: 'Needed for India hiring.',
          config: {},
          rules: [],
        },
        {
          id: 'question-2',
          questionText: 'Notice period',
          questionType: 'NUMBER',
          required: false,
          helpText: null,
          config: {},
          rules: [],
        },
      ],
    },
    templates: {
      items: [
        { id: 'template-1', questionText: 'Portfolio URL', questionType: 'URL', usageCount: 3 },
      ],
    },
    addJobQuestionAction: noop,
    addJobQuestionFromLibraryAction: noop,
    createScreeningTemplateAction: noop,
    deleteJobQuestionAction: noop,
    duplicateJobQuestionAction: noop,
    reorderJobQuestionsAction: noop,
    updateJobQuestionAction: noop,
  };
}

describe('ScreeningQuestionBuilder', () => {
  test('changes controls by question type and hides rules for file uploads', async () => {
    const user = userEvent.setup();
    render(<ScreeningQuestionBuilder {...buildProps()} />);
    const addQuestionCard = screen.getByRole('heading', { name: 'Add custom question' }).closest('div');
    const addQuestionScope = within(addQuestionCard);

    expect(screen.getByRole('button', { name: 'Move Work authorisation down' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move Notice period up' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to job' })).toBeInTheDocument();

    await user.selectOptions(addQuestionScope.getByLabelText('Question type'), 'FILE_UPLOAD');
    expect(addQuestionScope.getByLabelText('Allowed file types')).toBeInTheDocument();
    expect(addQuestionScope.queryByLabelText('Rule operator')).not.toBeInTheDocument();
  });

  test('validates select questions before submit and keeps required toggle available', async () => {
    const user = userEvent.setup();
    render(<ScreeningQuestionBuilder {...buildProps()} />);
    const addQuestionCard = screen.getByRole('heading', { name: 'Add custom question' }).closest('div');
    const addQuestionScope = within(addQuestionCard);

    await user.selectOptions(addQuestionScope.getByLabelText('Question type'), 'SINGLE_SELECT');
    await user.type(addQuestionScope.getByLabelText('Question text'), 'Preferred shift');
    fireEvent.submit(addQuestionScope.getByRole('button', { name: 'Add custom question' }).closest('form'));

    expect(screen.getByText('Select questions require at least two options.')).toBeInTheDocument();
    expect(addQuestionScope.getByRole('checkbox', { name: 'Required' })).toBeInTheDocument();
  });

  test('has no obvious accessibility violations', async () => {
    const { container } = render(<ScreeningQuestionBuilder {...buildProps()} />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
