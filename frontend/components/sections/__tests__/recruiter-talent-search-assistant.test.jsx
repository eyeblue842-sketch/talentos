import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecruiterTalentSearchAssistant } from '../recruiter-talent-search-assistant';

const routerPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}));

describe('RecruiterTalentSearchAssistant', () => {
  beforeEach(() => {
    routerPush.mockReset();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          keyword: 'Java Spring Boot AWS',
          location: 'Bengaluru',
          minExperience: 6,
          maxExperience: 10,
          skills: ['Java', 'Spring Boot', 'AWS'],
          parsedQuery: {
            mode: 'HYBRID',
            originalQuery: 'Java Spring Boot AWS Bengaluru',
            filters: {
              requiredSkills: ['Java', 'Spring Boot', 'AWS'],
              optionalSkills: ['Kafka'],
            },
          },
          interpretedFilters: ['Java', 'Bengaluru', '6-10 years'],
        },
      }),
    });
  });

  it('routes to review filters instead of immediately running an opaque search', async () => {
    render(<RecruiterTalentSearchAssistant />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Find Java developers in Bengaluru with AWS and Spring Boot' } });
    fireEvent.click(screen.getByRole('button', { name: /Search with AI/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Review filters/i }));

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith(expect.stringContaining('reviewFilters=true'));
      expect(routerPush).toHaveBeenCalledWith(expect.stringContaining('requiredSkills=Java%2C+Spring+Boot%2C+AWS'));
    });
  });
});
