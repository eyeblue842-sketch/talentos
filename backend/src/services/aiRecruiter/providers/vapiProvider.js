import { env } from '../../../config/env.js';

// Vapi telephony provider (international / non-India leg). Places an outbound
// call with the published assistant over the Twilio-backed Vapi phone number,
// passing our screening variables as assistantOverrides.variableValues.
// See https://docs.vapi.ai/api-reference/calls/create

const TIMEOUT_MS = 20000;

export function isConfigured() {
  return Boolean(env.vapiApiKey && env.vapiAssistantId && env.vapiPhoneNumberId);
}

export async function dispatch({ toPhoneNumber, variables, screeningCallId }) {
  if (!isConfigured()) {
    throw new Error('Vapi is not configured (VAPI_API_KEY / VAPI_ASSISTANT_ID / VAPI_PHONE_NUMBER_ID).');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${env.vapiApiBaseUrl}/call`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.vapiApiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        assistantId: env.vapiAssistantId,
        phoneNumberId: env.vapiPhoneNumberId,
        customer: { number: toPhoneNumber },
        assistantOverrides: { variableValues: variables },
        // Echoed back on every webhook so we can match the call even before
        // the provider id round-trips.
        metadata: { screeningCallId },
      }),
    });

    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON error body */ }

    if (!response.ok) {
      throw new Error(`Vapi call create failed (${response.status}): ${json?.message || text || 'unknown error'}`);
    }
    return { providerCallId: json?.id || null };
  } finally {
    clearTimeout(timer);
  }
}

export const vapiProvider = { isConfigured, dispatch };
