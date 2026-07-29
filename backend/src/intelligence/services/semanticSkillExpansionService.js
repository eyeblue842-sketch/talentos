import { semanticSearchExpansionItemSchema } from '@careeriz/shared';
import { normalizeSkillName } from './candidateIntelligenceService.js';

const EXPANSION_VERSION = 'semantic-skill-expansion-v1';
const MAX_EXPANSIONS_PER_TERM = 8;

const expansionCatalog = new Map([
  ['React', [
    ['React', 'ALIAS', 1, 'catalog'],
    ['React.js', 'ALIAS', 0.98, 'catalog'],
    ['Next.js', 'RELATED', 0.76, 'catalog'],
    ['Redux', 'RELATED', 0.7, 'catalog'],
    ['Hooks', 'CHILD', 0.68, 'catalog'],
    ['TypeScript', 'TRANSFERABLE', 0.56, 'catalog'],
  ]],
  ['AWS', [
    ['AWS', 'ALIAS', 1, 'catalog'],
    ['Amazon Web Services', 'ALIAS', 0.99, 'catalog'],
    ['EC2', 'CHILD', 0.77, 'catalog'],
    ['Lambda', 'CHILD', 0.72, 'catalog'],
    ['S3', 'CHILD', 0.72, 'catalog'],
    ['CloudFormation', 'RELATED', 0.58, 'catalog'],
  ]],
  ['Spring Boot', [
    ['Spring Boot', 'ALIAS', 1, 'catalog'],
    ['Spring Framework', 'PARENT', 0.82, 'catalog'],
    ['Java', 'PARENT', 0.74, 'catalog'],
    ['Microservices', 'RELATED', 0.61, 'catalog'],
  ]],
  ['Node.js', [
    ['Node.js', 'ALIAS', 1, 'catalog'],
    ['JavaScript', 'PARENT', 0.82, 'catalog'],
    ['Express.js', 'CHILD', 0.72, 'catalog'],
    ['TypeScript', 'TRANSFERABLE', 0.58, 'catalog'],
  ]],
  ['Java', [
    ['Java', 'ALIAS', 1, 'catalog'],
    ['Spring Boot', 'RELATED', 0.73, 'catalog'],
    ['Kafka', 'RELATED', 0.55, 'catalog'],
    ['Microservices', 'RELATED', 0.54, 'catalog'],
  ]],
  ['TypeScript', [
    ['TypeScript', 'ALIAS', 1, 'catalog'],
    ['JavaScript', 'PARENT', 0.9, 'catalog'],
    ['React', 'TRANSFERABLE', 0.56, 'catalog'],
    ['Next.js', 'TRANSFERABLE', 0.54, 'catalog'],
  ]],
]);

function clampConfidence(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function uniqueTerms(values = []) {
  return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))];
}

export function expandSemanticSkills(inputTerms = [], options = {}) {
  const expansionEnabled = options.expansionEnabled !== false;
  const transferableEnabled = options.transferableSkillsEnabled !== false;
  const originalTerms = uniqueTerms(inputTerms);
  const expansions = [];
  const warnings = [];
  const seen = new Set();

  for (const originalTerm of originalTerms) {
    const normalizedTerm = normalizeSkillName(originalTerm) || originalTerm;
    const catalogEntries = expansionCatalog.get(normalizedTerm) || [[normalizedTerm, 'ALIAS', 1, 'normalizer']];
    let added = 0;

    for (const [expandedTermRaw, relationshipType, confidenceRaw, source] of catalogEntries) {
      if (!expansionEnabled && relationshipType !== 'ALIAS') continue;
      if (!transferableEnabled && relationshipType === 'TRANSFERABLE') continue;
      if (added >= MAX_EXPANSIONS_PER_TERM) break;

      const expandedTerm = normalizeSkillName(expandedTermRaw) || expandedTermRaw;
      const key = `${normalizedTerm.toLowerCase()}::${expandedTerm.toLowerCase()}::${relationshipType}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const confidence = clampConfidence(confidenceRaw);
      if (relationshipType === 'TRANSFERABLE' && confidence < 0.6) {
        warnings.push(`Transferable skill expansion for ${normalizedTerm} should be reviewed.`);
      }

      expansions.push(semanticSearchExpansionItemSchema.parse({
        originalTerm,
        normalizedTerm,
        expandedTerm,
        relationshipType,
        confidence,
        source,
        version: EXPANSION_VERSION,
      }));
      added += 1;
    }
  }

  return {
    version: EXPANSION_VERSION,
    expansions,
    warnings: uniqueTerms(warnings).slice(0, 10),
  };
}
