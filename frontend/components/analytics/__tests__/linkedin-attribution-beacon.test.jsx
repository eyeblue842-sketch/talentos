import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/jobs/senior-engineer' }));

import { LinkedInAttributionBeacon } from '../linkedin-attribution-beacon';

describe('LinkedInAttributionBeacon', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    Object.defineProperty(window.navigator, 'globalPrivacyControl', { value: false, configurable: true });
  });

  it('reports one click for a valid li reference, sending only the opaque ref and a random visitor id', () => {
    window.history.pushState({}, '', '/jobs/senior-engineer?li=0123456789abcdef');
    render(<LinkedInAttributionBeacon />);

    const click = global.fetch.mock.calls.map(([, init]) => JSON.parse(init.body)).filter((body) => body.eventType === 'CLICK');
    expect(click).toHaveLength(1);
    expect(click[0].ref).toBe('0123456789abcdef');
    expect(click[0].visitorId).toMatch(/^[a-f0-9]{24}$/);
    expect(Object.keys(click[0]).sort()).toEqual(['eventType', 'ref', 'visitorId']);
  });

  it('ignores malformed references and sends nothing', () => {
    window.history.pushState({}, '', '/jobs/senior-engineer?li=not-a-ref');
    render(<LinkedInAttributionBeacon />);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends nothing when Global Privacy Control is set', () => {
    Object.defineProperty(window.navigator, 'globalPrivacyControl', { value: true, configurable: true });
    window.history.pushState({}, '', '/jobs/senior-engineer?li=0123456789abcdef');
    render(<LinkedInAttributionBeacon />);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
