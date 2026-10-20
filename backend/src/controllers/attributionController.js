import { sendSuccess } from '../utils/response.js';
import { recordAttributionEvent } from '../services/linkedin/linkedinAttributionService.js';

// Public, privacy-conscious funnel beacon. Accepts only an opaque link
// reference, an event type and (for anonymous events) a random per-tab visitor
// id. Always answers 202 for unknown references so references cannot be probed.
export async function postAttributionEvent(req, res, next) {
  try {
    const { ref, eventType, visitorId } = req.body || {};
    const result = await recordAttributionEvent({ ref, eventType, visitorId, userId: req.user?.id || null });
    sendSuccess(res, 202, { recorded: Boolean(result.recorded) });
  } catch (error) {
    next(error);
  }
}
