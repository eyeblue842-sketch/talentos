import { describe, expect, test } from 'vitest';
import { adminNav, candidateNav, getNavigationForRole, recruiterNav } from '@/lib/navigation';

describe('getNavigationForRole', () => {
  test('RECRUITER and RECRUITER_ADMIN both get the full recruiter navigation', () => {
    expect(getNavigationForRole('RECRUITER')).toBe(recruiterNav);
    expect(getNavigationForRole('RECRUITER_ADMIN')).toBe(recruiterNav);
  });

  test('CANDIDATE and CANDIDATE_ADMIN both get the candidate navigation', () => {
    expect(getNavigationForRole('CANDIDATE')).toBe(candidateNav);
    expect(getNavigationForRole('CANDIDATE_ADMIN')).toBe(candidateNav);
  });

  test('ADMIN, SUPER_ADMIN and PLATFORM_ADMIN all get the admin navigation', () => {
    expect(getNavigationForRole('ADMIN')).toBe(adminNav);
    expect(getNavigationForRole('SUPER_ADMIN')).toBe(adminNav);
    expect(getNavigationForRole('PLATFORM_ADMIN')).toBe(adminNav);
  });

  test('unknown roles get no navigation', () => {
    expect(getNavigationForRole('UNKNOWN')).toEqual([]);
  });

  test('recruiter navigation exposes every core recruiter module by href', () => {
    const hrefs = recruiterNav.flatMap((item) => (item.children ? item.children.map((child) => child.href) : [item.href]));
    expect(hrefs).toEqual(expect.arrayContaining([
      '/recruiter/home',
      '/recruiter/jobs',
      '/recruiter/database',
      '/recruiter/ats',
      '/recruiter/interviews',
      '/recruiter/members',
      '/recruiter/settings',
    ]));
  });
});
