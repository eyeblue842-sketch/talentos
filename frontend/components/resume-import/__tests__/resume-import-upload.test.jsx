import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ResumeImportUploadExperience } from '@/components/resume-import/experience';

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};

const toastPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/recruiter/candidates/import',
}));

vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual('@/components/ui/toast');
  return {
    ...actual,
    useToast: () => ({ push: toastPush }),
  };
});

class MockXHR {
  static nextPayload = { status: 201, body: { success: true, data: { id: 'batch-123', createdAt: '2026-07-27T08:00:00.000Z' } } };

  constructor() {
    this.upload = {};
    this.responseText = '';
    this.status = 0;
  }

  open() {}

  send() {
    this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
    this.status = MockXHR.nextPayload.status;
    this.responseText = JSON.stringify(MockXHR.nextPayload.body);
    this.onload?.();
  }
}

describe('ResumeImportUploadExperience', () => {
  beforeEach(() => {
    router.push.mockReset();
    router.refresh.mockReset();
    toastPush.mockReset();
    global.XMLHttpRequest = MockXHR;
  });

  test('shows validation when ZIP and individual files are combined', async () => {
    render(
      <ResumeImportUploadExperience
        limits={{ maxFiles: 100, maxFileSizeMb: 10, maxZipSizeMb: 100, maxFileSizeBytes: 10 * 1024 * 1024, maxZipSizeBytes: 100 * 1024 * 1024 }}
        batchHrefPrefix="/recruiter/candidates/import"
        historyHref="/recruiter/candidates/import/history"
      />
    );

    const input = screen.getByLabelText(/choose resume files/i);
    const files = [
      new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }),
      new File(['zip'], 'batch.zip', { type: 'application/zip' }),
    ];

    fireEvent.change(input, { target: { files } });

    expect(await screen.findByText(/either one ZIP file or individual resumes/i)).toBeInTheDocument();
  });

  test('uploads valid files and shows the created batch reference', async () => {
    const user = userEvent.setup();

    render(
      <ResumeImportUploadExperience
        limits={{ maxFiles: 100, maxFileSizeMb: 10, maxZipSizeMb: 100, maxFileSizeBytes: 10 * 1024 * 1024, maxZipSizeBytes: 100 * 1024 * 1024 }}
        batchHrefPrefix="/recruiter/candidates/import"
        historyHref="/recruiter/candidates/import/history"
      />
    );

    const input = screen.getByLabelText(/choose resume files/i);
    fireEvent.change(input, {
      target: {
        files: [new File(['pdf-content'], 'candidate.pdf', { type: 'application/pdf' })],
      },
    });

    await user.click(screen.getByRole('button', { name: /start import/i }));

    expect(await screen.findByText(/batch created/i)).toBeInTheDocument();
    expect(screen.getByText(/batch-123/i)).toBeInTheDocument();
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(toastPush).toHaveBeenCalledWith(expect.objectContaining({ tone: 'success' }));
  });
});

