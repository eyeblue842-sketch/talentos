const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)/g;
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"')]+/gi;
const LINKEDIN_PATTERN = /\b(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s<>"')]+/i;
const POSTAL_ADDRESS_FRAGMENT_PATTERN = /\b(?:address\s*:?\s*)?(?:flat|room|plot|door|house|apt|apartment|suite|unit|block|sector|street|st\.|road|rd\.|lane|ln\.|nagar|colony|avenue|ave\.|building|bldg|tower|phase|district)\b.*(?:\d{5,6}|india|usa|united states|zip|pincode|postal code)\b/i;
const PERSONAL_URL_HOST_PATTERN = /\b(?:github\.io|about\.me|linktr\.ee|me\.|bio\.site|carrd\.co)\b/i;
const PRESERVE_NUMERIC_CONTEXT_PATTERN = /\b(?:\d+(?:\.\d+)?\s*(?:years?|yrs?|months?|lpa|lac|lakhs?|cr|crore|crores|usd|eur|inr|days?|%))\b/i;

// Strips non-whitespace ASCII control characters (0x00-0x08, 0x0B, 0x0C,
// 0x0E-0x1F, 0x7F) while preserving tab/newline/CR for the whitespace-
// normalization steps that follow. Written as a code-point filter rather
// than a regex control-char range so no-control-regex has nothing to flag.
function isNonWhitespaceControlCodePoint(code) {
  return (code >= 0x00 && code <= 0x08)
    || code === 0x0b
    || code === 0x0c
    || (code >= 0x0e && code <= 0x1f)
    || code === 0x7f;
}

function stripNonWhitespaceControlCharacters(value) {
  let result = '';
  for (const char of value) {
    if (!isNonWhitespaceControlCodePoint(char.codePointAt(0))) result += char;
  }
  return result;
}

function normalizeWhitespace(value = '') {
  return stripNonWhitespaceControlCharacters(String(value || ''))
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
