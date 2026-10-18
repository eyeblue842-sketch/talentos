import { semanticSearchExpansionItemSchema } from '@careeriz/shared';
import { normalizeSkillName } from './candidateIntelligenceService.js';

const EXPANSION_VERSION = 'semantic-skill-expansion-v1';
const MAX_EXPANSIONS_PER_TERM = 8;

const expansionCatalog = new Map([
  ['React', [
    ['React', 'ALIAS', 1, 'catalog'],
    ['React.js', 'ALIAS', 0.98, 'catalog'],
    ['JavaScript', 'RELATED', 0.82, 'catalog'],
    ['TypeScript', 'RELATED', 0.78, 'catalog'],
    ['Next.js', 'RELATED', 0.76, 'catalog'],
    ['Redux', 'RELATED', 0.7, 'catalog'],
    ['Hooks', 'CHILD', 0.68, 'catalog'],
    ['HTML', 'RELATED', 0.62, 'catalog'],
    ['CSS', 'RELATED', 0.6, 'catalog'],
    ['Jest', 'RELATED', 0.55, 'catalog'],
  ]],
  ['AWS', [
    ['AWS', 'ALIAS', 1, 'catalog'],
    ['Amazon Web Services', 'ALIAS', 0.99, 'catalog'],
    ['EC2', 'CHILD', 0.77, 'catalog'],
    ['Lambda', 'CHILD', 0.72, 'catalog'],
    ['S3', 'CHILD', 0.72, 'catalog'],
    ['Docker', 'RELATED', 0.66, 'catalog'],
    ['Kubernetes', 'RELATED', 0.64, 'catalog'],
    ['Terraform', 'RELATED', 0.6, 'catalog'],
    ['CloudFormation', 'RELATED', 0.58, 'catalog'],
    ['DevOps', 'RELATED', 0.56, 'catalog'],
  ]],
  ['Spring Boot', [
    ['Spring Boot', 'ALIAS', 1, 'catalog'],
    ['Spring Framework', 'PARENT', 0.82, 'catalog'],
    ['Java', 'PARENT', 0.78, 'catalog'],
    ['Microservices', 'RELATED', 0.72, 'catalog'],
    ['Hibernate', 'RELATED', 0.68, 'catalog'],
    ['REST APIs', 'RELATED', 0.66, 'catalog'],
    ['JPA', 'RELATED', 0.6, 'catalog'],
  ]],
  ['Node.js', [
    ['Node.js', 'ALIAS', 1, 'catalog'],
    ['JavaScript', 'PARENT', 0.85, 'catalog'],
    ['Express.js', 'CHILD', 0.78, 'catalog'],
    ['TypeScript', 'RELATED', 0.72, 'catalog'],
    ['MongoDB', 'RELATED', 0.66, 'catalog'],
    ['REST APIs', 'RELATED', 0.64, 'catalog'],
    ['GraphQL', 'RELATED', 0.58, 'catalog'],
  ]],
  ['Java', [
    ['Java', 'ALIAS', 1, 'catalog'],
    ['Spring Boot', 'RELATED', 0.82, 'catalog'],
    ['Spring Framework', 'RELATED', 0.78, 'catalog'],
    ['Hibernate', 'RELATED', 0.72, 'catalog'],
    ['Microservices', 'RELATED', 0.7, 'catalog'],
    ['REST APIs', 'RELATED', 0.66, 'catalog'],
    ['J2EE', 'RELATED', 0.64, 'catalog'],
    ['Kafka', 'RELATED', 0.6, 'catalog'],
    ['SQL', 'RELATED', 0.56, 'catalog'],
    ['JavaScript', 'RELATED', 0.52, 'catalog'],
  ]],
  ['JavaScript', [
    ['JavaScript', 'ALIAS', 1, 'catalog'],
    ['TypeScript', 'RELATED', 0.84, 'catalog'],
    ['React', 'RELATED', 0.8, 'catalog'],
    ['Node.js', 'RELATED', 0.76, 'catalog'],
    ['Angular', 'RELATED', 0.68, 'catalog'],
    ['Vue.js', 'RELATED', 0.64, 'catalog'],
    ['HTML', 'RELATED', 0.62, 'catalog'],
    ['CSS', 'RELATED', 0.6, 'catalog'],
  ]],
  ['Python', [
    ['Python', 'ALIAS', 1, 'catalog'],
    ['Django', 'RELATED', 0.8, 'catalog'],
    ['Flask', 'RELATED', 0.76, 'catalog'],
    ['FastAPI', 'RELATED', 0.7, 'catalog'],
    ['Pandas', 'RELATED', 0.68, 'catalog'],
    ['NumPy', 'RELATED', 0.64, 'catalog'],
    ['Machine Learning', 'RELATED', 0.62, 'catalog'],
    ['SQL', 'RELATED', 0.58, 'catalog'],
  ]],
  ['Angular', [
    ['Angular', 'ALIAS', 1, 'catalog'],
    ['TypeScript', 'RELATED', 0.84, 'catalog'],
    ['JavaScript', 'RELATED', 0.8, 'catalog'],
    ['RxJS', 'RELATED', 0.68, 'catalog'],
    ['HTML', 'RELATED', 0.62, 'catalog'],
    ['CSS', 'RELATED', 0.6, 'catalog'],
  ]],
  ['SQL', [
    ['SQL', 'ALIAS', 1, 'catalog'],
    ['MySQL', 'RELATED', 0.78, 'catalog'],
    ['PostgreSQL', 'RELATED', 0.76, 'catalog'],
    ['Oracle', 'RELATED', 0.68, 'catalog'],
    ['PL/SQL', 'RELATED', 0.64, 'catalog'],
    ['Database Design', 'RELATED', 0.58, 'catalog'],
  ]],
  ['Docker', [
    ['Docker', 'ALIAS', 1, 'catalog'],
    ['Kubernetes', 'RELATED', 0.82, 'catalog'],
    ['DevOps', 'RELATED', 0.74, 'catalog'],
    ['CI/CD', 'RELATED', 0.68, 'catalog'],
    ['Jenkins', 'RELATED', 0.62, 'catalog'],
    ['AWS', 'RELATED', 0.58, 'catalog'],
  ]],
  ['Kubernetes', [
    ['Kubernetes', 'ALIAS', 1, 'catalog'],
    ['Docker', 'RELATED', 0.84, 'catalog'],
    ['DevOps', 'RELATED', 0.74, 'catalog'],
    ['Helm', 'RELATED', 0.64, 'catalog'],
    ['Microservices', 'RELATED', 0.62, 'catalog'],
    ['AWS', 'RELATED', 0.58, 'catalog'],
  ]],
  ['TypeScript', [
    ['TypeScript', 'ALIAS', 1, 'catalog'],
    ['JavaScript', 'PARENT', 0.9, 'catalog'],
    ['React', 'RELATED', 0.76, 'catalog'],
    ['Angular', 'RELATED', 0.7, 'catalog'],
    ['Node.js', 'RELATED', 0.66, 'catalog'],
    ['Next.js', 'RELATED', 0.6, 'catalog'],
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
