import { env } from '../../../config/env.js';

// Plivo telephony provider (India / +91 leg). The Careeriz screening agent is
// built in Plivo's AI Agent Studio with an "API Request" trigger - an HTTP
// endpoint that starts an outbound call when POSTed to. We send the candidate's
// number, the Careeriz +91 caller id, and the screening variables.
//
// NOTE: the exact trigger URL and the precise request body are finalized once
// the Plivo agent is PUBLISHED (the published trigger node shows its URL and
// expected payload). This dispatch sends a conventional body; adjust the field
// names here to match the published trigger during the live-call test. Until
// PLIVO_SCREENING_AGENT_TRIGGER_URL is set, isConfigured() is false and the
// orchestrator keeps India calls in DRY_RUN.

const TIMEOUT_MS = 20000;

export function isConfigured() {
  return Boolean(env.plivoScreeningAgentTriggerUrl && env.plivoScreeningCallerId);
}

export async function dispatch({ toPhoneNumber, callerId, variables, screeningCallId }) {
  if (!isConfigured()) {
    throw new Error('Plivo screening agent is not configured (PLIVO_SCREENING_AGENT_TRIGGER_URL / PLIVO_SCREENING_CALLER_ID).');
  }

  const headers = { 'Content-Type': 'application/json' };
  // The agent trigger may be protected with the account's Basic auth; include
  // it when the auth id/token are available.
  if (env.plivoAuthId && env.plivoAuthToken) {
    const basic = Buffer.from(`${env.plivoAuthId}:${env.plivoAuthToken}`).toString('base64');
    headers.Authorization = `Basic ${basic}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(env.plivoScreeningAgentTriggerUrl, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        to: toPhoneNumber,
        from: callerId || env.plivoScreeningCallerId,
        // Plivo agent variables are passed through so the flow can interpolate
        // them. `metadata` carries our id back on webhooks.
        variables,
        metadata: { screeningCallId },
      }),
    });

    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }

    if (!response.ok) {
      throw new Error(`Plivo agent trigger failed (${response.status}): ${json?.message || text || 'unknown error'}`);
    }
    // Plivo returns a call/run identifier; field name is confirmed at publish.
    return { providerCallId: json?.call_uuid || json?.callUuid || json?.request_uuid || json?.id || null };
  } finally {
    clearTimeout(timer);
  }
}

export const plivoProvider = { isConfigured, dispatch };
