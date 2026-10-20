'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// First-party LinkedIn attribution beacon.
//
// Privacy: the only thing read from a shared link is the opaque `li` reference
// (16 hex chars - no name, e-mail or user id). It is kept in sessionStorage for
// the tab only (no cookie, nothing persisted across sessions) together with a
// random per-tab visitor id used solely to de-duplicate. Nothing is sent when
// the browser signals Global Privacy Control / Do Not Track.
//
// Outcome events (registration, resume, profile, application) are sent while
// the user is signed in; the server counts them ONLY if the database proves
// them, so repeated/optimistic calls are harmless.

const REF_KEY = 'careeriz.li.ref';
const VISITOR_KEY = 'careeriz.li.visitor';
const SENT_KEY = 'careeriz.li.sent';
const REF_PATTERN = /^[a-f0-9]{16}$/;
const OUTCOMES = ['REGISTRATION_COMPLETE', 'RESUME_UPLOAD', 'PROFILE_COMPLETE', 'APPLICATION'];
const MAX_OUTCOME_ATTEMPTS = 6;

function privacyOptOut() {
  if (typeof navigator === 'undefined') return true;
  return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
}

function read(key) {
  try { return window.sessionStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { window.sessionStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

function visitorId() {
  let id = read(VISITOR_KEY);
  if (!id) {
    const bytes = new Uint8Array(12);
    window.crypto.getRandomValues(bytes);
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    write(VISITOR_KEY, id);
  }
  return id;
}

function sentCounts() {
  try { return JSON.parse(read(SENT_KEY) || '{}'); } catch { return {}; }
}

async function send(ref, eventType) {
  try {
    const response = await fetch('/api/public/attribution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref, eventType, visitorId: visitorId() }),
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function LinkedInAttributionBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (privacyOptOut()) return;
    const fromUrl = new URLSearchParams(window.location.search).get('li');
    if (fromUrl && REF_PATTERN.test(fromUrl)) write(REF_KEY, fromUrl);
    const ref = read(REF_KEY);
    if (!ref) return;

    const sent = sentCounts();
    const mark = (type) => { sent[type] = (sent[type] || 0) + 1; write(SENT_KEY, JSON.stringify(sent)); };

    if (fromUrl && pathname.startsWith('/jobs/') && !sent.CLICK) {
      mark('CLICK');
      send(ref, 'CLICK');
    }
    if ((pathname.startsWith('/auth') || pathname.includes('/register') || pathname.includes('/signup')) && !sent.REGISTRATION_START) {
      mark('REGISTRATION_START');
      send(ref, 'REGISTRATION_START');
    }
    for (const type of OUTCOMES) {
      if ((sent[type] || 0) >= MAX_OUTCOME_ATTEMPTS) continue;
      mark(type);
      send(ref, type);
    }
  }, [pathname]);

  return null;
}
