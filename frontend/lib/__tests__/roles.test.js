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

  test('CANDIDATE_ADMIN behaves as a normal candidate: candidate home, no admin panel access', () => {
    expect(getHomeRouteForRole('CANDIDATE_ADMIN')).toBe('/candidate/dashboard');
    expect(resolvePostAuthRoute('CANDIDATE_ADMIN', '/candidate/applications')).toBe('/candidate/applications');
    expect(resolvePostAuthRoute('CANDIDATE_ADMIN', '/admin')).toBe('/candidate/dashboard');
  });

  test('RECRUITER_ADMIN gets the admin panel plus the normal recruiter workspace', () => {
    expect(getHomeRouteForRole('RECRUITER_ADMIN')).toBe('/admin');
    expect(resolvePostAuthRoute('RECRUITER_ADMIN', '/admin')).toBe('/admin');
    expect(resolvePostAuthRoute('RECRUITER_ADMIN', '/recruiter/jobs')).toBe('/recruiter/jobs');
    expect(resolvePostAuthRoute('RECRUITER_ADMIN', '/candidate/applications')).toBe('/admin');
  });

  test('PLATFORM_ADMIN is scoped to the admin panel only', () => {
    expect(getHomeRouteForRole('PLATFORM_ADMIN')).toBe('/admin');
    expect(resolvePostAuthRoute('PLATFORM_ADMIN', '/admin')).toBe('/admin');
    expect(resolvePostAuthRoute('PLATFORM_ADMIN', '/recruiter/jobs')).toBe('/admin');
  });
});
