import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ResumeImportBatchDetailExperience } from '@/components/resume-import/experience';

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};

const toastPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/recruiter/candidates/import/batch-1',
}));

vi.mock('@/components/ui/toast', async () => {
  const actual = await vi.importActual('@/components/ui/toast');
  return {
    ...actual,
    useToast: () => ({ push: toastPush }),
  };
});

describe('ResumeImportBatchDetailExperience', () => {
  beforeEach(() => {
    router.push.mockReset();
    router.refresh.mockReset();
    toastPush.mockReset();
    global.fetch = vi.fn(async (url, init = {}) => {
      if (String(url).includes('/retry-failed')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: { retriedCount: 1 } }),
        };
      }

      if (String(url).includes('/items')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [{
              id: 'item-1',
              originalFilename: 'candidate.pdf',
              mimeType: 'application/pdf',
              fileSizeBytes: 1024,
              status: 'FAILED',
              parsedData: { candidate: { fullName: { value: 'Candidate Person' }, email: { value: 'candidate@example.com' }, phoneNumber: { value: '+1 555 000 0001' } } },
              errorCode: 'AI_TIMEOUT',
              errorMessage: 'Timed out',
              updatedAt: '2026-07-27T09:00:00.000Z',
            }],
            meta: { page: 1, pageCount: 1, total: 1 },
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'batch-1',
            createdByUserId: 'user-1',
            totalItemCount: 1,
            processedCount: 1,
            successCount: 0,
            reviewCount: 0,
            duplicateCount: 0,
            failedCount: 1,
            status: 'FAILED',
            createdAt: '2026-07-27T08:00:00.000Z',
            startedAt: '2026-07-27T08:01:00.000Z',
            completedAt: '2026-07-27T08:02:00.000Z',
            durationMs: 60000,
          },
        }),
      };
    });
  });

  test('renders summary cards and item rows', () => {
    render(
      <ResumeImportBatchDetailExperience
        initialBatch={{
          id: 'batch-1',
          createdByUserId: 'user-1',
          totalItemCount: 1,
          processedCount: 1,
          successCount: 0,
          reviewCount: 0,
          duplicateCount: 0,
          failedCount: 1,
          status: 'FAILED',
          createdAt: '2026-07-27T08:00:00.000Z',
          startedAt: '2026-07-27T08:01:00.000Z',
          completedAt: '2026-07-27T08:02:00.000Z',
          durationMs: 60000,
        }}
        initialItems={[{
          id: 'item-1',
          originalFilename: 'candidate.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 1024,
          status: 'FAILED',
          parsedData: { candidate: { fullName: { value: 'Candidate Person' }, email: { value: 'candidate@example.com' }, phoneNumber: { value: '+1 555 000 0001' } } },
          errorCode: 'AI_TIMEOUT',
          errorMessage: 'Timed out',
          updatedAt: '2026-07-27T09:00:00.000Z',
        }]}
        initialMeta={{ page: 1, pageCount: 1, total: 1 }}
        initialQuery={{}}
        batchId="batch-1"
        historyHref="/recruiter/candidates/import/history"
        itemHrefBase="/recruiter/candidates/import/batch-1/items"
      />
    );

    expect(screen.getByText(/batch batch-1/i)).toBeInTheDocument();
    expect(screen.getByText('candidate.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry failed/i })).toBeInTheDocument();
  });

  test('retries failed items through the batch action', async () => {
    const user = userEvent.setup();

    render(
      <ResumeImportBatchDetailExperience
        initialBatch={{
          id: 'batch-1',
          createdByUserId: 'user-1',
          totalItemCount: 1,
          processedCount: 1,
          successCount: 0,
          reviewCount: 0,
          duplicateCount: 0,
          failedCount: 1,
          status: 'FAILED',
          createdAt: '2026-07-27T08:00:00.000Z',
          startedAt: '2026-07-27T08:01:00.000Z',
          completedAt: '2026-07-27T08:02:00.000Z',
          durationMs: 60000,
        }}
        initialItems={[]}
        initialMeta={{ page: 1, pageCount: 1, total: 0 }}
        initialQuery={{}}
        batchId="batch-1"
        historyHref="/recruiter/candidates/import/history"
        itemHrefBase="/recruiter/candidates/import/batch-1/items"
      />
    );

    await user.click(screen.getByRole('button', { name: /retry failed/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/resume-imports/batch-1/retry-failed',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(toastPush).toHaveBeenCalledWith(expect.objectContaining({ tone: 'success' }));
  });
});

