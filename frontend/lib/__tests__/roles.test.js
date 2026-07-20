import { describe, expect, test } from 'vitest';
import { getHomeRouteForRole, resolvePostAuthRoute } from '@/lib/roles';

describe('role routing', () => {
  test('maps canonical roles to their home routes', () => {
    expect(getHomeRouteForRole('CANDIDATE')).toBe('/candidate/dashboard');
    expect(getHomeRouteForRole('RECRUITER')).toBe('/recruiter');
    expect(getHomeRouteForRole('ADMIN')).toBe('/admin');
    expect(getHomeRouteForRole('SUPER_ADMIN')).toBe('/admin');
    expect(getHomeRouteForRole('HIRING_MANAGER')).toBe('/recruiter');
    expect(getHomeRouteForRole('INTERVIEWER')).toBe('/recruiter/ats');
  });

  test('falls back safely for unsupported roles', () => {
    expect(getHomeRouteForRole('UNKNOWN')).toBe('/auth');
    expect(resolvePostAuthRoute('UNKNOWN', '/candidate')).toBe('/auth');
  });

  test('keeps candidate-safe destinations and rejects recruiter access to candidate pages', () => {
    expect(resolvePostAuthRoute('CANDIDATE', '/jobs/frontend-engineer/apply')).toBe('/jobs/frontend-engineer/apply');
    expect(resolvePostAuthRoute('CANDIDATE', '/candidate/applications')).toBe('/candidate/applications');
    expect(resolvePostAuthRoute('RECRUITER', '/candidate/applications')).toBe('/recruiter');
  });

  test('keeps recruiter-safe destinations and normalizes auth or root entry points to home', () => {
    expect(resolvePostAuthRoute('RECRUITER', '/recruiter/jobs')).toBe('/recruiter/jobs');
    expect(resolvePostAuthRoute('RECRUITER', '/auth')).toBe('/recruiter');
    expect(resolvePostAuthRoute('CANDIDATE', '/')).toBe('/candidate/dashboard');
  });
});
