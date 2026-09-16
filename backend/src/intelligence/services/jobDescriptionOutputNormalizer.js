import {
  canonicalJobDescriptionOutputSchema,
  JOB_DESCRIPTION_FIELD_LIMITS,
  JOB_DESCRIPTION_LIST_LIMITS,
  JOB_DESCRIPTION_OUTPUT_FIELDS,
} from '@careeriz/shared';

const LIST_FIELDS = {
  keyResponsibilities: {
    maxItems: JOB_DESCRIPTION_LIST_LIMITS.keyResponsibilities,
    maxLength: JOB_DESCRIPTION_FIELD_LIMITS.keyResponsibility,
    splitOverlong: true,
  },
  requiredQualifications: {
    maxItems: JOB_DESCRIPTION_LIST_LIMITS.requiredQualifications,
    maxLength: JOB_DESCRIPTION_FIELD_LIMITS.qualification,
  },
  preferredQualifications: {
    maxItems: JOB_DESCRIPTION_LIST_LIMITS.preferredQualifications,
    maxLength: JOB_DESCRIPTION_FIELD_LIMITS.qualification,
  },
  screeningQuestions: {
    maxItems: JOB_DESCRIPTION_LIST_LIMITS.screeningQuestions,
    maxLength: JOB_DESCRIPTION_FIELD_LIMITS.screeningQuestion,
  },
  assumptions: {
    maxItems: JOB_DESCRIPTION_LIST_LIMITS.assumptions,
    maxLength: JOB_DESCRIPTION_FIELD_LIMITS.assumption,
  },
  exclusionaryWordingWarnings: {
    maxItems: JOB_DESCRIPTION_LIST_LIMITS.exclusionaryWordingWarnings,
    maxLength: JOB_DESCRIPTION_FIELD_LIMITS.warning,
  },
  missingFields: {
    maxItems: JOB_DESCRIPTION_LIST_LIMITS.missingFields,
    maxLength: JOB_DESCRIPTION_FIELD_LIMITS.missingField,
  },
  interviewFocus: {
    maxItems: JOB_DESCRIPTION_LIST_LIMITS.interviewFocus,
    maxLength: JOB_DESCRIPTION_FIELD_LIMITS.interviewFocus,
  },
};

const TEXT_FIELDS = {
  openingSummary: JOB_DESCRIPTION_FIELD_LIMITS.openingSummary,
  roleOverview: JOB_DESCRIPTION_FIELD_LIMITS.roleOverview,
};

export class JobDescriptionValidationError extends Error {
  constructor(message, diagnostics = []) {
    super(message);
    this.name = 'JobDescriptionValidationError';
    this.code = 'JOB_DESCRIPTION_SCHEMA_INVALID';
    this.statusCode = 502;
    this.diagnostics = diagnostics;
  }
}

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(items) {
  return [...new Set(items)];
}

function splitResponsibility(value, maxLength) {
  const text = normalizeWhitespace(value);
  if (!text) return [];
  if (text.length <= maxLength) return [text];

  const parts = [];
  const clauses = text
    .split(/(?<=[.!?])\s+|\s*;\s+|\s+and\s+(?=[A-Z]?[a-z])/)
    .map(normalizeWhitespace)
    .filter(Boolean);

  let current = '';
  for (const clause of clauses) {
    if (clause.length > maxLength) return null;
    const next = current ? `${current}; ${clause}` : clause;
    if (next.length <= maxLength) {
      current = next;
    } else {
      if (current) parts.push(current);
      current = clause;
    }
  }
  if (current) parts.push(current);

  return parts.length && parts.every((item) => item.length <= maxLength) ? parts : null;
}

function normalizeList(value, field, diagnostics) {
  const config = LIST_FIELDS[field];
  const source = Array.isArray(value) ? value : [];
  const items = [];

  source.forEach((item, index) => {
    const text = normalizeWhitespace(item);
    if (!text) {
      diagnostics.push({
        path: `${field}.${index}`,
        reason: 'item_blank',
      });
      return;
    }

    if (text.length <= config.maxLength) {
      items.push(text);
      return;
    }

    if (config.splitOverlong) {
      const split = splitResponsibility(text, config.maxLength);
      if (split) {
        diagnostics.push({
          path: `${field}.${index}`,
          reason: 'split_overlong_item',
          maxLength: config.maxLength,
          receivedLength: text.length,
          producedItems: split.length,
        });
        items.push(...split);
        return;
      }
    }

    diagnostics.push({
      path: `${field}.${index}`,
      reason: 'item_too_long',
      maxLength: config.maxLength,
      receivedLength: text.length,
    });
  });

  return unique(items).slice(0, config.maxItems);
}

function normalizeAdditionalSections(value, diagnostics) {
  const source = Array.isArray(value) ? value : [];
  const sections = [];
  source.forEach((entry, index) => {
    const heading = normalizeWhitespace(entry?.heading);
    const body = normalizeWhitespace(entry?.body);
    if (!heading || !body) {
      // A section missing either half is dropped, not fatal - the AI is
      // instructed to omit empty sections rather than emit placeholders.
      if (heading || body) {
        diagnostics.push({ path: `additionalSections.${index}`, reason: 'section_incomplete' });
      }
      return;
    }
    if (heading.length > JOB_DESCRIPTION_FIELD_LIMITS.additionalSectionHeading
      || body.length > JOB_DESCRIPTION_FIELD_LIMITS.additionalSectionBody) {
      diagnostics.push({ path: `additionalSections.${index}`, reason: 'section_invalid' });
      return;
    }
    sections.push({ heading, body });
  });
  return sections.slice(0, JOB_DESCRIPTION_LIST_LIMITS.additionalSections);
}

function sanitizeZodIssues(error) {
  return (error?.issues || error?.errors || []).map((issue) => ({
    path: issue.path?.join('.') || '(root)',
    reason: issue.code || 'invalid',
    maxLength: issue.maximum && issue.type === 'string' ? issue.maximum : undefined,
    minItems: issue.minimum && issue.type === 'array' ? issue.minimum : undefined,
    keys: issue.keys,
    message: issue.message,
  }));
}

export function normalizeJobDescriptionOutput(rawOutput) {
  if (!rawOutput || typeof rawOutput !== 'object' || Array.isArray(rawOutput)) {
    throw new JobDescriptionValidationError('AI job description output was not a JSON object.', [{
      path: '(root)',
      reason: 'not_object',
    }]);
  }

  const diagnostics = [];
  const normalized = {};
  const extras = Object.keys(rawOutput).filter((key) => !JOB_DESCRIPTION_OUTPUT_FIELDS.includes(key));
  extras.forEach((key) => diagnostics.push({ path: key, reason: 'discarded_unsupported_field' }));

  for (const [field, maxLength] of Object.entries(TEXT_FIELDS)) {
    const text = normalizeWhitespace(rawOutput[field]);
    normalized[field] = text;
    if (text.length > maxLength) {
      diagnostics.push({
        path: field,
        reason: 'text_too_long',
        maxLength,
        receivedLength: text.length,
      });
    }
  }

  for (const field of Object.keys(LIST_FIELDS)) {
    normalized[field] = normalizeList(rawOutput[field], field, diagnostics);
  }

  normalized.additionalSections = normalizeAdditionalSections(rawOutput.additionalSections, diagnostics);

  const hardFailures = diagnostics.filter((item) => ['item_blank', 'item_too_long', 'text_too_long', 'section_invalid'].includes(item.reason));
  if (hardFailures.length) {
    throw new JobDescriptionValidationError('AI job description output exceeded canonical limits.', hardFailures);
  }

  const parsed = canonicalJobDescriptionOutputSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new JobDescriptionValidationError('AI job description output failed canonical validation.', [
      ...diagnostics,
      ...sanitizeZodIssues(parsed.error),
    ]);
  }

  return {
    output: parsed.data,
    diagnostics,
  };
}

export function summarizeJobDescriptionValidationError(error) {
  if (error?.code !== 'JOB_DESCRIPTION_SCHEMA_INVALID') return [];
  return (error.diagnostics || []).map((item) => ({
    path: item.path,
    reason: item.reason,
    maxLength: item.maxLength,
    minItems: item.minItems,
    receivedLength: item.receivedLength,
    producedItems: item.producedItems,
    keys: item.keys,
  }));
}
