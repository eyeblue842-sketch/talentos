const SEARCH_FIELDS = Object.freeze({
  keyword: ['normalizedSkills^6', 'currentTitle^5', 'previousTitles^4', 'currentEmployer^4', 'previousEmployers^3', 'industries^3', 'employmentHistoryText^3', 'projectsText^2.5', 'educationText^1.5', 'certifications^2'],
  phrase: ['normalizedSkills^8', 'currentTitle^6', 'previousTitles^5', 'employmentHistoryText^4', 'projectsText^3', 'certifications^3'],
  shortCode: ['normalizedSkills^8', 'currentTitle^6', 'previousTitles^5', 'employmentHistoryText^3', 'projectsText^2'],
});

const CURATED_CONCEPTS = [
  { canonical: 'javascript', variants: ['javascript', 'java script', 'js'], shortCode: 'js', phraseFirst: false },
  { canonical: 'typescript', variants: ['typescript', 'type script', 'ts'], shortCode: 'ts', phraseFirst: false },
  { canonical: 'amazon web services', variants: ['amazon web services', 'aws'], shortCode: 'aws', phraseFirst: true },
  { canonical: 'google cloud platform', variants: ['google cloud platform', 'gcp'], shortCode: 'gcp', phraseFirst: true },
  { canonical: 'human resources', variants: ['human resources', 'hr'], shortCode: 'hr', phraseFirst: true, ambiguousAbbreviation: true },
  { canonical: 'talent acquisition', variants: ['talent acquisition', 'recruitment'], phraseFirst: true },
  { canonical: 'information technology', variants: ['information technology', 'it'], shortCode: 'it', phraseFirst: true, ambiguousAbbreviation: true },
  { canonical: 'business development', variants: ['business development', 'bd'], shortCode: 'bd', phraseFirst: true, ambiguousAbbreviation: true },
  { canonical: 'pl/sql', variants: ['pl/sql', 'pl sql', 'pl-sql'], phraseFirst: true, punctuationSensitive: true },
  { canonical: 'oracle apex', variants: ['oracle apex', 'oracle application express'], phraseFirst: true },
  { canonical: 'spring boot', variants: ['spring boot', 'springboot'], phraseFirst: true },
  { canonical: 'c', variants: ['c'], exactOnly: true, ambiguousAbbreviation: true, fieldMode: 'shortCode' },
  { canonical: 'c++', variants: ['c++', 'cpp'], exactOnly: true, punctuationSensitive: true, fieldMode: 'shortCode' },
  { canonical: 'c#', variants: ['c#', 'csharp'], exactOnly: true, punctuationSensitive: true, fieldMode: 'shortCode' },
  { canonical: '.net', variants: ['.net', 'dotnet'], exactOnly: true, punctuationSensitive: true, fieldMode: 'shortCode' },
  { canonical: 'node.js', variants: ['node.js', 'nodejs', 'node js'], punctuationSensitive: true, phraseFirst: true },
];

function normalizeWhitespace(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function normalizeConceptToken(value = '') {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[`'"]/g, '')
    .replace(/\s+/g, ' ');
}

export function resolveCuratedConcept(term = '') {
  const normalized = normalizeConceptToken(term);
  return CURATED_CONCEPTS.find((concept) => concept.variants.some((variant) => normalizeConceptToken(variant) === normalized)) || null;
}

export function buildConceptVariants(term = '') {
  const concept = resolveCuratedConcept(term);
  if (!concept) {
    return {
      canonical: normalizeWhitespace(term),
      variants: [normalizeWhitespace(term)],
      fieldMode: 'keyword',
      phraseFirst: /\s/.test(term),
      exactOnly: false,
      ambiguousAbbreviation: false,
    };
  }

  return {
    canonical: concept.canonical,
    variants: [...new Set(concept.variants.map((variant) => normalizeWhitespace(variant)).filter(Boolean))],
    fieldMode: concept.fieldMode || (concept.ambiguousAbbreviation ? 'shortCode' : 'keyword'),
    phraseFirst: Boolean(concept.phraseFirst),
    exactOnly: Boolean(concept.exactOnly),
    ambiguousAbbreviation: Boolean(concept.ambiguousAbbreviation),
  };
}

export function getSearchFields(mode = 'keyword') {
  return SEARCH_FIELDS[mode] || SEARCH_FIELDS.keyword;
}

// Detects any ASCII control character (0x00-0x1F, 0x7F). Written as a
// code-point scan rather than a regex control-char range so
// no-control-regex has nothing to flag.
function hasAsciiControlCharacter(value) {
  for (const char of value) {
    const code = char.codePointAt(0);
    if ((code >= 0x00 && code <= 0x1f) || code === 0x7f) return true;
  }
  return false;
}

export function isControlCharacterSafe(value = '') {
  return !hasAsciiControlCharacter(String(value || ''));
}
