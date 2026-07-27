import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ResumeImportItemReviewExperience } from '@/components/resume-import/experience';

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};

const toastPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/recruiter/candidates/import/batch-1/items/item-1',
}));

vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual('@/components/ui/toast');
  return {
    ...actual,
    useToast: () => ({ push: toastPush }),
  };
});

describe('ResumeImportItemReviewExperience', () => {
  beforeEach(() => {
    router.push.mockReset();
    router.refresh.mockReset();
    toastPush.mockReset();

    global.fetch = vi.fn(async (url, init = {}) => {
      if (String(url).endsWith('/confirm')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              item: {
                id: 'item-1',
                batchId: 'batch-1',
                originalFilename: 'candidate.pdf',
                status: 'IMPORTED',
                candidateId: 'candidate-1',
                mimeType: 'application/pdf',
                fileExtension: '.pdf',
                fileSizeBytes: 1024,
                parsedData: { candidate: { fullName: { value: 'Candidate Person', confidence: 0.92 }, email: { value: 'candidate@example.com', confidence: 0.7 } } },
                updatedAt: '2026-07-27T09:05:00.000Z',
              },
              candidateId: 'candidate-1',
              duplicate: false,
            },
          }),
        };
      }

      if (String(url).endsWith('/resolve-duplicate')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              item: {
                id: 'item-1',
                batchId: 'batch-1',
                originalFilename: 'candidate.pdf',
                status: 'IMPORTED',
                candidateId: 'candidate-1',
                mimeType: 'application/pdf',
                fileExtension: '.pdf',
                fileSizeBytes: 1024,
                parsedData: { candidate: { fullName: { value: 'Candidate Person', confidence: 0.92 } } },
                updatedAt: '2026-07-27T09:05:00.000Z',
              },
              candidateId: 'candidate-1',
            },
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'item-1',
            batchId: 'batch-1',
            originalFilename: 'candidate.pdf',
            status: 'READY',
            mimeType: 'application/pdf',
            fileExtension: '.pdf',
            fileSizeBytes: 1024,
            parsedData: { candidate: { fullName: { value: 'Candidate Person', confidence: 0.92 }, email: { value: 'candidate@example.com', confidence: 0.7 }, phoneNumber: { value: '+1 555 000 0001', confidence: 0.45 }, skills: { value: ['React', 'Node.js'], confidence: 0.8 } } },
            reviewNotes: 'Needs recruiter check',
            requiresManualReview: false,
            updatedAt: '2026-07-27T09:05:00.000Z',
          },
        }),
      };
    });
  });

  test('renders parsed fields and confirms a candidate', async () => {
    const user = userEvent.setup();

    render(
      <ResumeImportItemReviewExperience
        initialBatch={{ id: 'batch-1' }}
        initialItem={{
          id: 'item-1',
          batchId: 'batch-1',
          originalFilename: 'candidate.pdf',
          status: 'READY',
          mimeType: 'application/pdf',
          fileExtension: '.pdf',
          fileSizeBytes: 1024,
          parsedData: {
            candidate: {
              fullName: { value: 'Candidate Person', confidence: 0.92 },
              email: { value: 'candidate@example.com', confidence: 0.7 },
              phoneNumber: { value: '+1 555 000 0001', confidence: 0.45 },
              skills: { value: ['React', 'Node.js'], confidence: 0.8 },
            },
          },
          reviewNotes: 'Needs recruiter check',
          requiresManualReview: false,
          updatedAt: '2026-07-27T09:05:00.000Z',
        }}
        existingCandidatePreview={null}
        historyHref="/recruiter/candidates/import/history"
        batchHref="/recruiter/candidates/import/batch-1"
        candidateProfileHrefBase="/recruiter/database"
        aiEnabled
      />
    );

    expect(screen.getByDisplayValue('Candidate Person')).toBeInTheDocument();
    expect(screen.getByText(/low confidence/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirm candidate/i }));
    await user.click(screen.getByRole('button', { name: /confirm and create candidate/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/resume-imports/batch-1/items/item-1/confirm',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(toastPush).toHaveBeenCalledWith(expect.objectContaining({ tone: 'success' }));
  });

  test('shows duplicate resolution and sends the chosen action', async () => {
    const user = userEvent.setup();

    render(
      <ResumeImportItemReviewExperience
        initialBatch={{ id: 'batch-1' }}
        initialItem={{
          id: 'item-1',
          batchId: 'batch-1',
          originalFilename: 'candidate.pdf',
          status: 'DUPLICATE',
          duplicateCandidateId: 'candidate-1',
          duplicateReason: 'email',
          mimeType: 'application/pdf',
          fileExtension: '.pdf',
          fileSizeBytes: 1024,
          parsedData: { candidate: { fullName: { value: 'Candidate Person', confidence: 0.92 }, email: { value: 'candidate@example.com', confidence: 0.7 } } },
          reviewNotes: '',
          requiresManualReview: true,
          updatedAt: '2026-07-27T09:05:00.000Z',
        }}
        existingCandidatePreview={{
          id: 'candidate-1',
          fullName: 'Existing Candidate',
          contactEmail: 'existing@example.com',
          currentCompany: 'Acme',
          title: 'Engineer',
        }}
        historyHref="/recruiter/candidates/import/history"
        batchHref="/recruiter/candidates/import/batch-1"
        candidateProfileHrefBase="/recruiter/database"
        aiEnabled={false}
      />
    );

    expect(screen.getByText(/duplicate comparison/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /resolve duplicate/i }));
    await user.selectOptions(screen.getByLabelText(/resolution/i), 'ATTACHED_TO_EXISTING');
    await user.click(screen.getByRole('button', { name: /apply resolution/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/resume-imports/batch-1/items/item-1/resolve-duplicate',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});

