import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeResumeSearchText } from '../services/resumeSearchV2/privacy.js';
import { sanitizePlainResultText } from '../services/resumeSearchV2/service.js';
import { isControlCharacterSafe } from '../services/resumeSearchV2/synonyms.js';

// These control characters are built with String.fromCharCode instead of
// literal escapes so this file itself never contains a regex control-char
// range for eslint's no-control-regex rule to flag.
const NUL = String.fromCharCode(0x00);
const BACKSPACE = String.fromCharCode(0x08);
const VTAB = String.fromCharCode(0x0b);
const FORM_FEED = String.fromCharCode(0x0c);
const UNIT_SEPARATOR = String.fromCharCode(0x1f);
const DEL = String.fromCharCode(0x7f);
const TAB = String.fromCharCode(0x09);
const LF = String.fromCharCode(0x0a);
const CR = String.fromCharCode(0x0d);

test('sanitizeResumeSearchText strips non-whitespace control characters while preserving newline-driven line structure and redaction', () => {
  const input = `Senior Backend Engineer${NUL}${BACKSPACE}${VTAB}${FORM_FEED}${UNIT_SEPARATOR}${DEL}\nContact: jane.doe@example.com`;

  const result = sanitizeResumeSearchText(input);

  assert.ok(!result.includes(NUL));
  assert.ok(!result.includes(BACKSPACE));
  assert.ok(!result.includes(VTAB));
  assert.ok(!result.includes(FORM_FEED));
  assert.ok(!result.includes(UNIT_SEPARATOR));
  assert.ok(!result.includes(DEL));
  assert.match(result, /Senior Backend Engineer/);
  assert.match(result, /\[redacted-email\]/);
  assert.ok(!result.includes('jane.doe@example.com'));
});

test('sanitizeResumeSearchText still collapses real whitespace (tab/CRLF) exactly as before the control-char rewrite', () => {
  const input = `Line one${TAB}has a tab${CR}${LF}Line two`;

  const result = sanitizeResumeSearchText(input);

  assert.equal(result, 'Line one has a tab\nLine two');
});

test('sanitizePlainResultText strips every ASCII control character including tab/newline/CR', () => {
  const input = `Bangalore${NUL}${TAB}${LF}${CR}${UNIT_SEPARATOR}${DEL}, India`;

  const result = sanitizePlainResultText(input);

  assert.equal(result, 'Bangalore, India');
});

test('isControlCharacterSafe reports false for any embedded control character and true for clean text', () => {
  assert.equal(isControlCharacterSafe('spring boot'), true);
  assert.equal(isControlCharacterSafe(`spring${NUL}boot`), false);
  assert.equal(isControlCharacterSafe(`spring${DEL}boot`), false);
  assert.equal(isControlCharacterSafe(`spring${UNIT_SEPARATOR}boot`), false);
});
