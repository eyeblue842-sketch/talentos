export const RESUME_SEARCH_INDEX_SCHEMA_VERSION = 'v1';
export const RESUME_SEARCH_INDEX_VERSION = 'careeriz-resume-search-v1';
export const RESUME_SEARCH_READ_ALIAS = 'careeriz-resume-search-read';
export const RESUME_SEARCH_WRITE_ALIAS = 'careeriz-resume-search-write';

export function buildResumeSearchIndexName(prefix = 'careeriz-resume-search') {
  return `${prefix}-v1`;
}

export function buildResumeSearchIndexMapping() {
  return {
    settings: {
      analysis: {
        normalizer: {
          lc: {
            type: 'custom',
            filter: ['lowercase', 'asciifolding'],
          },
        },
        filter: {
          resume_synonyms_v1: {
            type: 'synonym_graph',
            synonyms_path: 'analysis/resume_synonyms_v1.txt',
          },
        },
        analyzer: {
          resume_text: {
            tokenizer: 'standard',
            filter: ['lowercase', 'asciifolding', 'resume_synonyms_v1'],
          },
          resume_text_exactable: {
            tokenizer: 'standard',
            filter: ['lowercase', 'asciifolding'],
          },
        },
      },
    },
    mappings: {
      dynamic: 'strict',
      properties: {
        documentId: { type: 'keyword' },
        candidateId: { type: 'keyword' },
        resumeId: { type: 'keyword' },
        importItemId: { type: 'keyword' },
        resumeSource: { type: 'keyword', normalizer: 'lc' },
        sourceOrganisationId: { type: 'keyword' },
        visibilityClassification: { type: 'keyword' },
        contactVisibilityClassification: { type: 'keyword' },
        searchableProfile: { type: 'boolean' },
        normalizedName: {
          type: 'text',
          analyzer: 'resume_text_exactable',
          fields: { raw: { type: 'keyword', normalizer: 'lc' } },
        },
        currentTitle: {
          type: 'text',
          analyzer: 'resume_text',
          fields: { raw: { type: 'keyword', normalizer: 'lc' } },
        },
        previousTitles: { type: 'text', analyzer: 'resume_text' },
        normalizedSkills: {
          type: 'text',
          analyzer: 'resume_text',
          fields: { raw: { type: 'keyword', normalizer: 'lc' } },
        },
        rawSkills: { type: 'text', analyzer: 'resume_text_exactable' },
        totalExperienceMonths: { type: 'integer' },
        currentEmployer: {
          type: 'text',
          analyzer: 'resume_text',
          fields: { raw: { type: 'keyword', normalizer: 'lc' } },
        },
        previousEmployers: { type: 'text', analyzer: 'resume_text' },
        industries: { type: 'keyword', normalizer: 'lc' },
        employmentHistoryText: { type: 'text', analyzer: 'resume_text' },
        projectsText: { type: 'text', analyzer: 'resume_text' },
        educationText: { type: 'text', analyzer: 'resume_text' },
        certifications: { type: 'text', analyzer: 'resume_text' },
        languages: { type: 'keyword', normalizer: 'lc' },
        currentLocation: { type: 'keyword', normalizer: 'lc' },
        preferredLocations: { type: 'keyword', normalizer: 'lc' },
        noticePeriodDays: { type: 'integer' },
        salarySearchable: { type: 'boolean' },
        currentSalaryNormalized: { type: 'integer', index: true },
        expectedSalaryNormalized: { type: 'integer', index: true },
        parsingConfidence: { type: 'float' },
        reviewRequired: { type: 'boolean' },
        resumeUpdatedAt: { type: 'date' },
        profileUpdatedAt: { type: 'date' },
        sourceVersion: { type: 'keyword' },
        indexSchemaVersion: { type: 'keyword' },
      },
    },
  };
}
