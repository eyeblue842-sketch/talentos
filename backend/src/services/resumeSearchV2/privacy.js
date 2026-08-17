const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)/g;
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"')]+/gi;
const LINKEDIN_PATTERN = /\b(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s<>"')]+/i;
const POSTAL_ADDRESS_FRAGMENT_PATTERN = /\b(?:address\s*:?\s*)?(?:flat|room|plot|door|house|apt|apartment|suite|unit|block|sector|street|st\.|road|rd\.|lane|ln\.|nagar|colony|avenue|ave\.|building|bldg|tower|phase|district)\b.*(?:\d{5,6}|india|usa|united states|zip|pincode|postal code)\b/i;
const PERSONAL_URL_HOST_PATTERN = /\b(?:github\.io|about\.me|linktr\.ee|me\.|bio\.site|carrd\.co)\b/i;
const PRESERVE_NUMERIC_CONTEXT_PATTERN = /\b(?:\d+(?:\.\d+)?\s*(?:years?|yrs?|months?|lpa|lac|lakhs?|cr|crore|crores|usd|eur|inr|days?|%))\b/i;

function normalizeWhitespace(value = '') {
  return String(value || '')
    .replace(CONTROL_CHAR_PATTERN, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function shouldRedactPhone(candidate = '') {
  const digitsOnly = candidate.replace(/[^\d]/g, '');
  if (digitsOnly.length < 8 || digitsOnly.length > 15) return false;
  if (PRESERVE_NUMERIC_CONTEXT_PATTERN.test(candidate)) return false;
  return true;
}

function redactPersonalUrl(url) {
  if (LINKEDIN_PATTERN.test(url)) return '[redacted-contact-url]';
  if (PERSONAL_URL_HOST_PATTERN.test(url)) return '[redacted-contact-url]';
  return url;
}

function sanitizeLine(line = '') {
  let sanitized = normalizeWhitespace(line);
  if (!sanitized) return '';

  sanitized = sanitized.replace(EMAIL_PATTERN, '[redacted-email]');
  sanitized = sanitized.replace(URL_PATTERN, (url) => redactPersonalUrl(url));
  sanitized = sanitized.replace(PHONE_PATTERN, (candidate) => (shouldRedactPhone(candidate) ? '[redacted-phone]' : candidate));
  if (POSTAL_ADDRESS_FRAGMENT_PATTERN.test(sanitized)) {
    sanitized = sanitized.replace(POSTAL_ADDRESS_FRAGMENT_PATTERN, '[redacted-address]');
  }

  return sanitized
    .replace(/\[(redacted-email|redacted-phone|redacted-contact-url)\](?:\s*[|,;/]\s*\[(redacted-email|redacted-phone|redacted-contact-url)\])+/gi, '[redacted-contact]')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeResumeSearchText(value = '') {
  const lines = String(value || '').split(/\r?\n/);
  return lines
    .map((line) => sanitizeLine(line))
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function sanitizeResumeSearchTextList(values = []) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .map((value) => sanitizeResumeSearchText(value))
    .filter(Boolean))];
}
