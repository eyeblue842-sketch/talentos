import { describe, expect, test } from 'vitest';
import {
  buildResumeSearchQueryEntries,
  decorateResumeCandidate,
  decorateResumePreview,
  parseAiResumeQuery,
} from '@/lib/recruiter-resume-search';

describe('recruiter resume search helpers', () => {
  test('parses AI search prompts into structured filters', () => {
    expect(parseAiResumeQuery('Find a Java developer in Bangalore with Spring Boot and AWS, 6-10 years experience, available in 30 days.')).toMatchObject({
      location: 'Bangalore',
      minExperience: '6',
      maxExperience: '10',
      availability: 'ONE_MONTH',
    });
  });

  test('builds the existing recruiter search query contract', () => {
    expect(buildResumeSearchQueryEntries({
      aiQuery: 'Find a Java developer in Bangalore with Spring Boot and AWS, 6-10 years experience, available in 30 days.',
      page: '2',
    })).toEqual({
      keyword: 'Find a Java developer in Bangalore with Spring Boot and AWS, 6-10 years experience, available in 30 days.',
      skill: 'Java',
      location: 'Bangalore',
      minExperience: '6',
      maxExperience: '10',
      availability: 'ONE_MONTH',
      page: '2',
    });
  });

  test('decorates candidates and preview state with recruiter-facing signals', () => {
    const candidate = {
      id: 'cand-1',
      fullName: 'Aarav Sharma',
      headline: 'Java Developer',
      location: 'Bengaluru',
      totalExperience: 7,
      availability: 'ONE_MONTH',
      skills: ['Java', 'Spring Boot', 'AWS'],
      updatedAt: '2026-07-18T10:00:00.000Z',
      user: { email: 'aarav@example.com' },
    };

    const result = decorateResumeCandidate(candidate, { keyword: 'java', location: 'Bengaluru' });
    const preview = decorateResumePreview(candidate);

    expect(result.currentCompany).toBeTruthy();
    expect(result.matchScore).toBeGreaterThan(60);
    expect(result.noticePeriod).toBe('30 days');
    expect(preview.aiSummary).toMatch(/Aarav Sharma/);
    expect(preview.showContactInfo).toBe(true);
    expect(preview.atsPipeline.length).toBeGreaterThan(0);
  });
});
