import { semanticSearchParseResponseSchema } from '@careeriz/shared';

const OPERATOR_TOKENS = new Set(['AND', 'OR', 'NOT']);

function normalizeWhitespace(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sanitizeToken(token = '') {
  return String(token || '').replace(/^"+|"+$/g, '').trim();
}

function inferMode(payload, tokens) {
  if (payload.similarCandidateId) return 'SIMILAR_CANDIDATE';
  if (payload.similarJobId) return 'SIMILAR_JOB';
  if (payload.mode) return payload.mode;
  if (tokens.some((token) => OPERATOR_TOKENS.has(token)) || tokens.includes('(') || tokens.includes(')')) {
    return 'BOOLEAN';
  }
  if (tokens.length >= 8) return 'SEMANTIC';
  if (tokens.length >= 4) return 'HYBRID';
  return 'KEYWORD';
}

function tokenizeQuery(query = '') {
  const tokens = [];
  const matcher = /[a-z-]+:"[^"]+"|"[^"]+"|\(|\)|\bAND\b|\bOR\b|\bNOT\b|[^\s()]+/gi;
  for (const match of query.matchAll(matcher)) {
    tokens.push(match[0]);
  }
  return tokens;
}

function parseInlineRange(value) {
  const match = String(value || '').match(/(\d+)\s*(?:-|to)\s*(\d+)/i);
  if (!match) return { min: null, max: null };
  return {
    min: Number(match[1]),
    max: Number(match[2]),
  };
}

function extractInlineFilters(tokens) {
  const filters = {
    minExperience: null,
    maxExperience: null,
    location: null,
    workMode: null,
    employmentType: null,
    noticePeriodDaysMax: null,
    salaryMin: null,
    salaryMax: null,
    role: null,
    seniority: null,
    domain: null,
    currentEmployer: null,
    previousEmployer: null,
    education: null,
    certifications: [],
    skills: [],
  };

  const consumed = new Set();
  const lowerTokens = tokens.map((token) => token.toLowerCase());

  for (let index = 0; index < tokens.length; index += 1) {
    const rawToken = tokens[index];
    const token = lowerTokens[index];

    if (OPERATOR_TOKENS.has(rawToken) || rawToken === '(' || rawToken === ')') continue;

    if (token.startsWith('location:')) {
      filters.location = sanitizeToken(rawToken.split(':').slice(1).join(':'));
      consumed.add(index);
      continue;
    }
    if (token.startsWith('workmode:') || token.startsWith('work-mode:')) {
      filters.workMode = sanitizeToken(rawToken.split(':').slice(1).join(':')).toUpperCase();
      consumed.add(index);
      continue;
    }
    if (token.startsWith('employmenttype:') || token.startsWith('employment-type:')) {
      filters.employmentType = sanitizeToken(rawToken.split(':').slice(1).join(':')).toUpperCase();
      consumed.add(index);
      continue;
    }
    if (token.startsWith('experience:') || token.startsWith('exp:')) {
      const range = parseInlineRange(rawToken.split(':').slice(1).join(':'));
      filters.minExperience = range.min;
      filters.maxExperience = range.max;
      consumed.add(index);
      continue;
    }
    if (token.startsWith('notice:')) {
      const notice = Number.parseInt(rawToken.split(':').slice(1).join(':'), 10);
      filters.noticePeriodDaysMax = Number.isFinite(notice) ? notice : null;
      consumed.add(index);
      continue;
    }
    if (token.startsWith('salary:')) {
      const range = parseInlineRange(rawToken.split(':').slice(1).join(':'));
      filters.salaryMin = range.min;
      filters.salaryMax = range.max;
      consumed.add(index);
      continue;
    }
    if (token.startsWith('role:')) {
      filters.role = sanitizeToken(rawToken.split(':').slice(1).join(':'));
      consumed.add(index);
      continue;
    }
    if (token.startsWith('seniority:')) {
      filters.seniority = sanitizeToken(rawToken.split(':').slice(1).join(':'));
      consumed.add(index);
      continue;
    }
    if (token.startsWith('domain:')) {
      filters.domain = sanitizeToken(rawToken.split(':').slice(1).join(':'));
      consumed.add(index);
      continue;
    }
    if (token.startsWith('currentemployer:') || token.startsWith('current-employer:')) {
      filters.currentEmployer = sanitizeToken(rawToken.split(':').slice(1).join(':'));
      consumed.add(index);
      continue;
    }
    if (token.startsWith('previousemployer:') || token.startsWith('previous-employer:')) {
      filters.previousEmployer = sanitizeToken(rawToken.split(':').slice(1).join(':'));
      consumed.add(index);
      continue;
    }
    if (token.startsWith('education:')) {
      filters.education = sanitizeToken(rawToken.split(':').slice(1).join(':'));
      consumed.add(index);
      continue;
    }
    if (token.startsWith('cert:') || token.startsWith('certification:')) {
      filters.certifications.push(sanitizeToken(rawToken.split(':').slice(1).join(':')));
      consumed.add(index);
      continue;
    }
    if (token.startsWith('skill:') || token.startsWith('skills:')) {
      filters.skills.push(
        ...sanitizeToken(rawToken.split(':').slice(1).join(':'))
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      );
      consumed.add(index);
    }
  }

  return {
    filters,
    remainingTerms: tokens
      .filter((_, index) => !consumed.has(index))
      .map((token) => sanitizeToken(token))
      .filter(Boolean),
  };
}

function parseBooleanAst(tokens) {
  if (!tokens.length) return null;
  let position = 0;

  function current() {
    return tokens[position] || null;
  }

  function consume() {
    const token = current();
    position += 1;
    return token;
  }

  function parsePrimary() {
    const token = current();
    if (!token) return null;
    if (token === '(') {
      consume();
      const expression = parseOr();
      if (current() === ')') consume();
      return expression ? { type: 'GROUP', children: [expression] } : null;
    }
    if (token === 'NOT') {
      consume();
      const child = parsePrimary();
      return child ? { type: 'NOT', child } : null;
    }
    if (token === ')' || token === 'AND' || token === 'OR') return null;
    consume();
    const quoted = /^".*"$/.test(token);
    return {
      type: 'TERM',
      value: sanitizeToken(token),
      quoted,
    };
  }

  function parseAnd() {
    let left = parsePrimary();
    while (current() === 'AND') {
      consume();
      const right = parsePrimary();
      if (!right) break;
      left = { type: 'BINARY', operator: 'AND', left, right };
    }
    return left;
  }

  function parseOr() {
    let left = parseAnd();
    while (current() === 'OR') {
      consume();
      const right = parseAnd();
      if (!right) break;
      left = { type: 'BINARY', operator: 'OR', left, right };
    }
    return left;
  }

  return parseOr();
}

export function parseSearchQuery(payload = {}) {
  const originalQuery = normalizeWhitespace(payload.query || '');
  const tokens = tokenizeQuery(originalQuery);
  const { filters, remainingTerms } = extractInlineFilters(tokens);
  const quotedPhrases = tokens
    .filter((token) => /^".*"$/.test(token))
    .map((token) => sanitizeToken(token));
  const operators = tokens.filter((token) => OPERATOR_TOKENS.has(token));
  const mode = inferMode(payload, tokens);
  const booleanAst = mode === 'BOOLEAN' ? parseBooleanAst(tokens) : null;
  const terms = remainingTerms.filter((token) => !OPERATOR_TOKENS.has(token) && token !== '(' && token !== ')');
  const canonicalKeyword = normalizeWhitespace(terms.join(' '));

  return semanticSearchParseResponseSchema.parse({
    originalQuery,
    normalizedQuery: originalQuery,
    mode,
    tokens: tokens.map((token) => sanitizeToken(token) || token).filter(Boolean),
    quotedPhrases,
    operators,
    terms,
    booleanAst,
    canonicalKeyword,
    filters,
    warnings: [],
  });
}
