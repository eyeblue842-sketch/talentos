import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RecruiterTalentSearchAssistant } from '../recruiter-talent-search-assistant';
import { AnalyticsInsightPanel } from '../analytics-insight-panel';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('milestone 7 intelligence UI', () => {
  it('renders generated-content messaging for talent search assistance', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          interpretedFilters: ['Location: Bangalore', 'Skills: Java, AWS'],
          warnings: [],
        },
      }),
    });

    render(<RecruiterTalentSearchAssistant />);

    expect(screen.getByText(/AI-generated suggestion\. Review before use\./i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Find a Java developer/i), { target: { value: 'Find senior Java developers in Bangalore with AWS' } });
    fireEvent.click(screen.getByRole('button', { name: /Search with AI/i }));

    await waitFor(() => expect(screen.getByText(/Location: Bangalore/i)).toBeInTheDocument());
  });

  it('shows analytics insight references after generation', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          insight: {
            summary: 'Offer acceptance declined because released offers increased faster than accepted offers.',
            findings: ['Offer acceptance rate is 52.3% over the last 30 days.'],
            metricReferences: ['Offer acceptance rate: 52.3%', 'Released offers: 21'],
            cautions: ['Sample size is limited.'],
          },
        },
      }),
    });

    render(<AnalyticsInsightPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Generate Insight/i }));

    await waitFor(() => expect(screen.getByText(/Offer acceptance rate: 52\.3%/i)).toBeInTheDocument());
    expect(screen.getByText(/AI-generated suggestion\. Review before use\./i)).toBeInTheDocument();
  });
});
