import { z } from 'zod';

export const JOB_DESCRIPTION_FIELD_LIMITS = Object.freeze({
  openingSummary: 600,
  roleOverview: 4000,
  keyResponsibility: 400,
  qualification: 160,
  additionalSectionHeading: 80,
  additionalSectionBody: 2000,
  screeningQuestion: 400,
  assumption: 400,
  warning: 400,
  missingField: 400,
  interviewFocus: 400,
});

export const JOB_DESCRIPTION_LIST_LIMITS = Object.freeze({
  keyResponsibilities: 40,
  requiredQualifications: 40,
  preferredQualifications: 40,
  additionalSections: 8,
  screeningQuestions: 40,
  assumptions: 30,
  exclusionaryWordingWarnings: 20,
  missingFields: 30,
  interviewFocus: 30,
});

// Candidate-facing structured sections, in render order. Everything after
// this array in JOB_DESCRIPTION_OUTPUT_FIELDS is recruiter-internal metadata
// that must never reach a public serializer (see PUBLIC_JOB_PRIVATE_FIELD_NAMES).
export const JOB_DESCRIPTION_PUBLIC_FIELDS = Object.freeze([
  'openingSummary',
  'roleOverview',
  'keyResponsibilities',
  'requiredQualifications',
  'preferredQualifications',
  'additionalSections',
]);

export const JOB_DESCRIPTION_OUTPUT_FIELDS = Object.freeze([
  ...JOB_DESCRIPTION_PUBLIC_FIELDS,
  'screeningQuestions',
  'assumptions',
  'exclusionaryWordingWarnings',
  'missingFields',
  'interviewFocus',
]);

const roleSpecificTerms = /\b(role|position|developer|engineer|manager|analyst|consultant|specialist|architect|lead|anaplan|planning|finance|sales|operations|data|model|platform|product|customer|candidate|recruiter)\b/i;
const genericFiller = /\b(dynamic team|fast[- ]paced environment|self[- ]starter|go[- ]getter|wear many hats|rockstar|ninja)\b/i;
const anyQualification = /^\s*any(?:\s+qualification|\s+graduate|\s+degree)?\s*[.,;:!?]?\s*$/i;
const abbreviationPattern = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|No|vs|etc|e\.g|i\.e|U\.S|U\.K|U\.A\.E|Pvt|Ltd|Inc|Co)\.$/i;

function boundedString(maxLength) {
  return z.string().trim().min(1).max(maxLength);
}

export const additionalSectionShape = z.object({
  heading: boundedString(JOB_DESCRIPTION_FIELD_LIMITS.additionalSectionHeading),
  body: boundedString(JOB_DESCRIPTION_FIELD_LIMITS.additionalSectionBody),
}).strict();

export const canonicalJobDescriptionOutputShape = {
  openingSummary: boundedString(JOB_DESCRIPTION_FIELD_LIMITS.openingSummary),
  roleOverview: boundedString(JOB_DESCRIPTION_FIELD_LIMITS.roleOverview),
  keyResponsibilities: z.array(boundedString(JOB_DESCRIPTION_FIELD_LIMITS.keyResponsibility))
    .min(3)
    .max(JOB_DESCRIPTION_LIST_LIMITS.keyResponsibilities),
  requiredQualifications: z.array(boundedString(JOB_DESCRIPTION_FIELD_LIMITS.qualification))
    .max(JOB_DESCRIPTION_LIST_LIMITS.requiredQualifications),
  // Preferred qualifications are optional. When source facts do not support
  // any, the AI must return [] and no candidate-facing section is rendered -
  // never a "No preferred qualifications" placeholder.
  preferredQualifications: z.array(boundedString(JOB_DESCRIPTION_FIELD_LIMITS.qualification))
    .max(JOB_DESCRIPTION_LIST_LIMITS.preferredQualifications)
    .default([]),
  // Optional extra structured sections ({heading, body}) for genuinely
  // supplied facts that do not fit the fixed sections. Empty by default; the
  // AI must never invent a section to fill space.
  additionalSections: z.array(additionalSectionShape)
    .max(JOB_DESCRIPTION_LIST_LIMITS.additionalSections)
    .default([]),
  screeningQuestions: z.array(boundedString(JOB_DESCRIPTION_FIELD_LIMITS.screeningQuestion))
    .min(0)
    .max(JOB_DESCRIPTION_LIST_LIMITS.screeningQuestions)
    .default([]),
  assumptions: z.array(boundedString(JOB_DESCRIPTION_FIELD_LIMITS.assumption))
    .max(JOB_DESCRIPTION_LIST_LIMITS.assumptions)
    .default([]),
  exclusionaryWordingWarnings: z.array(boundedString(JOB_DESCRIPTION_FIELD_LIMITS.warning))
    .max(JOB_DESCRIPTION_LIST_LIMITS.exclusionaryWordingWarnings)
    .default([]),
  missingFields: z.array(boundedString(JOB_DESCRIPTION_FIELD_LIMITS.missingField))
    .max(JOB_DESCRIPTION_LIST_LIMITS.missingFields)
    .default([]),
  interviewFocus: z.array(boundedString(JOB_DESCRIPTION_FIELD_LIMITS.interviewFocus))
    .max(JOB_DESCRIPTION_LIST_LIMITS.interviewFocus)
    .default([]),
};

export const canonicalJobDescriptionOutputSchema = z.object(canonicalJobDescriptionOutputShape).strict().superRefine((value, ctx) => {
  const sentences = countSentences(value.roleOverview);
  if (sentences < 2 || sentences > 3 || !roleSpecificTerms.test(value.roleOverview)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['roleOverview'],
      message: 'Role overview must be 2-3 meaningful, role-specific sentences.',
    });
  }

  const additionalSectionText = (value.additionalSections || []).map((section) => `${section.heading} ${section.body}`).join(' ');
  if (genericFiller.test(value.openingSummary) || genericFiller.test(value.roleOverview) || genericFiller.test(additionalSectionText)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['roleOverview'],
      message: 'Job description text must not contain generic filler.',
    });
  }

  for (const [field, items] of Object.entries({
    requiredQualifications: value.requiredQualifications,
    preferredQualifications: value.preferredQualifications,
    keyResponsibilities: value.keyResponsibilities,
    screeningQuestions: value.screeningQuestions,
    interviewFocus: value.interviewFocus,
  })) {
    items.forEach((item, index) => {
      if (anyQualification.test(item)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field, index],
          message: 'Generic "Any" qualification is not allowed.',
        });
      }
      if (genericFiller.test(item)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field, index],
          message: 'Generic filler is not allowed.',
        });
      }
    });
  }
});

export function countSentences(value) {
  const text = String(value || '').trim();
  if (!text) return 0;

  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
    const segments = [...segmenter.segment(text)]
      .map((segment) => segment.segment.trim())
      .filter((segment) => /[A-Za-z0-9]/.test(segment));
    if (segments.length) return segments.length;
  }

  let count = 0;
  let current = '';
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    current += char;
    if (!/[.!?]/.test(char)) continue;

    const previousToken = current.trim().split(/\s+/).pop() || '';
    const nextChar = text[index + 1] || '';
    const nextNextChar = text[index + 2] || '';
    const looksDecimal = /\d/.test(text[index - 1] || '') && /\d/.test(nextChar);
    const looksAbbreviation = abbreviationPattern.test(previousToken);
    const boundary = !nextChar || /\s/.test(nextChar);
    const nextStartsSentence = !nextNextChar || /["'([]?[A-Z0-9]/.test(nextNextChar);

    if (boundary && !looksDecimal && !looksAbbreviation && nextStartsSentence) {
      count += 1;
      current = '';
    }
  }

  return count || (text ? 1 : 0);
}

function textFieldSchema(description, maxLength) {
  return {
    type: 'string',
    description,
    minLength: 1,
    maxLength,
  };
}

function listFieldSchema(description, itemDescription, maxItems, maxLength, minItems = 0) {
  return {
    type: 'array',
    description,
    minItems,
    maxItems,
    items: textFieldSchema(itemDescription, maxLength),
  };
}

export const canonicalJobDescriptionJsonSchema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: [...JOB_DESCRIPTION_OUTPUT_FIELDS],
  properties: {
    openingSummary: textFieldSchema(
      'Concise candidate-facing opening introduction (prose, not a list). Use only supplied job or requisition facts. Never invent missing facts.',
      JOB_DESCRIPTION_FIELD_LIMITS.openingSummary,
    ),
    roleOverview: textFieldSchema(
      'Role overview. Write 2-3 meaningful, role-specific sentences using only supplied job or requisition facts.',
      JOB_DESCRIPTION_FIELD_LIMITS.roleOverview,
    ),
    keyResponsibilities: listFieldSchema(
      'Role-specific key responsibilities. Do not repeat salary, location, shift, or employment facts unnecessarily.',
      'One responsibility statement.',
      JOB_DESCRIPTION_LIST_LIMITS.keyResponsibilities,
      JOB_DESCRIPTION_FIELD_LIMITS.keyResponsibility,
      3,
    ),
    requiredQualifications: listFieldSchema(
      'Required skills or qualifications explicitly supplied or clearly confirmed by structured source facts. Do not invent extra items to reach a count; return fewer items and use missingFields when source facts are incomplete. Never output "Any".',
      'One required skill or qualification.',
      JOB_DESCRIPTION_LIST_LIMITS.requiredQualifications,
      JOB_DESCRIPTION_FIELD_LIMITS.qualification,
    ),
    preferredQualifications: listFieldSchema(
      'Preferred qualifications only when supported by source facts; otherwise return an empty array. Never output a placeholder such as "None".',
      'One preferred qualification.',
      JOB_DESCRIPTION_LIST_LIMITS.preferredQualifications,
      JOB_DESCRIPTION_FIELD_LIMITS.qualification,
    ),
    additionalSections: {
      type: 'array',
      description: 'Optional extra structured sections for genuinely supplied facts that do not fit the fixed sections. Return [] when none; never invent a section.',
      minItems: 0,
      maxItems: JOB_DESCRIPTION_LIST_LIMITS.additionalSections,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['heading', 'body'],
        properties: {
          heading: textFieldSchema('Short section heading.', JOB_DESCRIPTION_FIELD_LIMITS.additionalSectionHeading),
          body: textFieldSchema('Section body prose using only supplied facts.', JOB_DESCRIPTION_FIELD_LIMITS.additionalSectionBody),
        },
      },
    },
    screeningQuestions: listFieldSchema(
      'Optional recruiter-reviewable screening question suggestions tied to required role evidence. Return [] when no useful question is justified; these are not public unless accepted by the recruiter.',
      'One screening question.',
      JOB_DESCRIPTION_LIST_LIMITS.screeningQuestions,
      JOB_DESCRIPTION_FIELD_LIMITS.screeningQuestion,
    ),
    assumptions: listFieldSchema(
      'Explicit assumptions caused by incomplete source data; return [] when none.',
      'One assumption.',
      JOB_DESCRIPTION_LIST_LIMITS.assumptions,
      JOB_DESCRIPTION_FIELD_LIMITS.assumption,
    ),
    exclusionaryWordingWarnings: listFieldSchema(
      'Warnings for exclusionary or ambiguous wording in source data; return [] when none.',
      'One wording warning.',
      JOB_DESCRIPTION_LIST_LIMITS.exclusionaryWordingWarnings,
      JOB_DESCRIPTION_FIELD_LIMITS.warning,
    ),
    missingFields: listFieldSchema(
      'Important missing source fields recruiters should review; return [] when none.',
      'One missing-field note.',
      JOB_DESCRIPTION_LIST_LIMITS.missingFields,
      JOB_DESCRIPTION_FIELD_LIMITS.missingField,
    ),
    interviewFocus: listFieldSchema(
      'Internal recruiter-review interview focus areas grounded in supplied required skills and responsibilities. These are not public job content.',
      'One interview focus area.',
      JOB_DESCRIPTION_LIST_LIMITS.interviewFocus,
      JOB_DESCRIPTION_FIELD_LIMITS.interviewFocus,
    ),
  },
});
