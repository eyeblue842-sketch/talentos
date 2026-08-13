import test, { afterEach, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

let prisma;
let env;
let processBackgroundTask;
let calculateProfileCompletion;
let normalizeCandidateProfileForPresentation;
let resetIntelligenceProvider;

let state;
let originalStoragePath;

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function now() {
  return new Date('2026-08-04T10:00:00.000Z');
}

function bufferFromPdf({ text = null } = {}) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 32 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    if (text) {
      for (const line of String(text).split('\n')) {
        doc.text(line);
        doc.moveDown(0.35);
      }
    } else {
      doc.addPage();
    }
    doc.end();
  });
}

function applyData(target, data = {}) {
  Object.assign(target, clone(data));
  target.updatedAt = now();
  return target;
}

function writeStoredResume(storageKey, buffer) {
  const fullPath = path.resolve(process.cwd(), env.localStoragePath, storageKey);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, buffer);
}

function seedCandidate(overrides = {}) {
  const candidate = {
    id: 'candidate-1',
    userId: 'user-1',
    source: 'DIRECT_SIGNUP',
    profileStatus: 'ACTIVE',
    fullName: '',
    email: null,
    phoneNumber: null,
    normalizedPhoneNumber: null,
    headline: null,
    currentTitle: null,
    currentEmployer: null,
    currentDesignation: null,
    location: null,
    currentCity: null,
    currentState: null,
    currentCountry: null,
    postalCode: null,
    preferredLocations: [],
    preferredRoles: [],
    totalExperience: 0,
    workplacePreferences: [],
    employmentPreferences: [],
    availability: 'IMMEDIATE',
    skills: [],
    functionalSkills: [],
    tools: [],
    frameworks: [],
    cloudPlatforms: [],
    databases: [],
    softSkills: [],
    experienceEntries: null,
    educationEntries: null,
    certificationEntries: null,
    languageEntries: null,
    projectEntries: null,
    portfolioLinks: null,
    summary: null,
    resumeUrl: '/api/candidate/resumes/resume-1/download',
    latestResumeAssetId: 'resume-1',
    portfolioUrl: null,
    linkedInUrl: null,
    linkedInUrlNormalized: null,
    githubUrl: null,
    profileVisibility: 'PRIVATE',
    recommendationEnabled: true,
    notifyForSavedJobUpdates: true,
    notifyForRecommendations: true,
    notifyForInterviews: true,
    notifyForApplicationUpdates: true,
    notifyForOffers: true,
    notifyForProfileReminders: true,
    notifyForMarketing: false,
    willingToRelocate: false,
    preferredIndustries: [],
    preferredCompanySizes: [],
    requiresVisaSponsorship: false,
    jobAlertEnabled: true,
    jobAlertFrequency: 'WEEKLY',
    searchableProfile: false,
    phoneVisibleToRecruiters: false,
    salaryVisibleToRecruiters: false,
    resumeVisibleToRecruiters: true,
    onboardingStep: 0,
    onboardingSkippedResume: false,
    accountLifecycleStatus: 'ACTIVE',
    profileViews: 0,
    rawResumeText: null,
    parserVersion: null,
    parserMetadata: null,
    profileCompletenessScore: 0,
    provenanceMetadata: null,
    createdAt: now(),
    updatedAt: now(),
    ...clone(overrides),
  };
  state.candidate = candidate;
  return candidate;
}

function seedResumeAsset(overrides = {}) {
  const asset = {
    id: 'resume-1',
    candidateId: 'candidate-1',
    ownerUserId: 'user-1',
    kind: 'RESUME',
    status: 'ACTIVE',
    source: 'UPLOAD',
    isPrimary: true,
    storageKey: 'resumes/2026/08/test-resume.pdf',
    storageProvider: 'local',
    originalFilename: 'candidate-resume.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 0,
    parsingStatus: 'PENDING',
    parsedText: null,
    parsedData: null,
    archivedAt: null,
    createdAt: now(),
    updatedAt: now(),
    ...clone(overrides),
  };
  state.asset = asset;
  return asset;
}

function installPrismaMocks() {
  prisma.resumeAsset.findUnique = async ({ where }) => {
    if (where.id !== state.asset.id) return null;
    return {
      ...clone(state.asset),
      candidate: clone(state.candidate),
    };
  };

  prisma.resumeAsset.update = async ({ where, data }) => {
    assert.equal(where.id, state.asset.id);
    applyData(state.asset, data);
    return clone(state.asset);
  };

  prisma.candidateProfile.update = async ({ where, data }) => {
    assert.equal(where.id, state.candidate.id);
    applyData(state.candidate, data);
    return clone(state.candidate);
  };
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ env } = await import('../config/env.js'));
  ({ processBackgroundTask } = await import('../services/backgroundTaskHandlers.js'));
  ({ calculateProfileCompletion } = await import('../services/candidateService.js'));
  ({ normalizeCandidateProfileForPresentation } = await import('../services/candidateProfileSanitizer.js'));
  ({ resetIntelligenceProvider } = await import('../intelligence/services/providerService.js'));
});

beforeEach(() => {
  state = {};
  originalStoragePath = env.localStoragePath;
  env.storageProvider = 'local';
  env.localStoragePath = '.tmp-candidate-resume-tests';
  env.aiResumeParsingEnabled = false;
  env.aiProvider = 'disabled';
  env.intelligenceEnabled = false;
  env.intelligenceProvider = 'DISABLED';
  env.intelligenceModel = null;
  env.intelligenceBaseUrl = 'https://example.test';
  env.intelligenceApiKey = 'test-key';
  env.resumeImportMaxTextChars = 120000;
  resetIntelligenceProvider();
  global.fetch = undefined;
  installPrismaMocks();
  fs.rmSync(path.resolve(process.cwd(), env.localStoragePath), { recursive: true, force: true });
});

afterEach(() => {
  fs.rmSync(path.resolve(process.cwd(), env.localStoragePath), { recursive: true, force: true });
  env.localStoragePath = originalStoragePath;
});

test('RESUME_PARSING populates an empty candidate profile from a valid PDF resume and increases completion', async () => {
  const candidate = seedCandidate();
  seedResumeAsset();
  const beforeCompletion = calculateProfileCompletion(candidate).percentage;

  const resumeBuffer = await bufferFromPdf({
    text: [
      'John Doe',
      'Senior React Developer',
      'Bengaluru, Karnataka, India',
      'john.doe@example.com',
      '+91 9876543210',
      'https://www.linkedin.com/in/johndoe',
      'https://github.com/johndoe',
      'Summary',
      'Frontend engineer building React and Node.js products.',
      'Skills',
      'React, Node.js, AWS, Docker, PostgreSQL',
      'Experience',
      'Senior React Developer at Acme',
      'Jan 2020 - Present',
      'Built customer-facing products.',
      'Education',
      'B.Tech Computer Science',
      'VTU',
      '2019',
    ].join('\n'),
  });
  state.asset.sizeBytes = resumeBuffer.length;
  writeStoredResume(state.asset.storageKey, resumeBuffer);

  const result = await processBackgroundTask({
    id: 'task-1',
    type: 'RESUME_PARSING',
    entityId: state.asset.id,
    payload: { assetId: state.asset.id },
  });

  assert.equal(result, 'success');
  assert.equal(state.asset.parsingStatus, 'COMPLETED');
  assert.match(state.asset.parsedText, /John Doe/);
  assert.equal(state.candidate.fullName, 'John Doe');
  assert.equal(state.candidate.email, 'john.doe@example.com');
  assert.equal(state.candidate.currentTitle, 'Senior React Developer');
  assert.equal(state.candidate.currentEmployer, 'Acme');
  assert.equal(state.candidate.location, 'Bengaluru, Karnataka, India');
  assert.equal(state.candidate.currentCity, 'Bengaluru');
  assert.equal(state.candidate.currentState, 'Karnataka');
  assert.equal(state.candidate.currentCountry, 'India');
  for (const skill of ['AWS', 'Docker', 'Node.js', 'PostgreSQL', 'React']) {
    assert.equal(state.candidate.skills.includes(skill), true);
  }
  assert.equal(Array.isArray(state.candidate.experienceEntries), true);
  assert.equal(Array.isArray(state.candidate.educationEntries), true);
  assert.equal(state.candidate.profileCompletenessScore > beforeCompletion, true);
});

test('RESUME_PARSING preserves an existing manual currentTitle while filling other empty fields', async () => {
  seedCandidate({
    currentTitle: 'Staff Frontend Engineer',
    skills: ['React'],
  });
  seedResumeAsset();

  const resumeBuffer = await bufferFromPdf({
    text: [
      'Jane Candidate',
      'Frontend Developer',
      'Pune, Maharashtra, India',
      'jane@example.com',
      'Skills',
      'React, Next.js, TypeScript',
    ].join('\n'),
  });
  state.asset.sizeBytes = resumeBuffer.length;
  writeStoredResume(state.asset.storageKey, resumeBuffer);

  await processBackgroundTask({
    id: 'task-2',
    type: 'RESUME_PARSING',
    entityId: state.asset.id,
    payload: { assetId: state.asset.id },
  });

  assert.equal(state.asset.parsingStatus, 'COMPLETED');
  assert.equal(state.candidate.currentTitle, 'Staff Frontend Engineer');
  assert.equal(state.candidate.email, 'jane@example.com');
  assert.equal(state.candidate.location, 'Pune, Maharashtra, India');
});

test('RESUME_PARSING replaces invalid non-empty parser pollution with validated parsed values', async () => {
  seedCandidate({
    currentTitle: 'E-Mail:',
    headline: 'Tata Consultancy Services (TCS)',
    currentEmployer: 'Pune, India',
    currentCity: 'optimizing dynamic',
    currentState: 'user-centric web applications using Angular',
    currentCountry: 'RxJS',
    certificationEntries: [
      { name: 'Work Experience' },
      { name: 'Anaplan Certified Model Builder' },
    ],
    skills: ['Languages & Frameworks: Angular 11+', 'React'],
  });
  seedResumeAsset();

  const resumeBuffer = await bufferFromPdf({
    text: [
      'Aditi Garg',
      'Senior Angular Developer',
      'Bengaluru, Karnataka, India',
      'aditi@example.com',
      '+91 9000000000',
      'Summary',
      'Senior Angular Developer with 7 years of experience building financial platforms.',
      'Skills',
      'Languages & Frameworks: Angular 11+, RxJS, TypeScript',
      'Performance & Optimization: Lazy Loading',
      'Experience',
      'Senior Angular Developer at Careeriz Labs',
      'Jan 2022 - Present',
      'Responsibilities: Built reusable Angular modules and mentoring workflows.',
      'Certifications',
      'AWS Certified Developer - Associate',
    ].join('\n'),
  });
  state.asset.sizeBytes = resumeBuffer.length;
  writeStoredResume(state.asset.storageKey, resumeBuffer);

  await processBackgroundTask({
    id: 'task-invalid-existing-repair',
    type: 'RESUME_PARSING',
    entityId: state.asset.id,
    payload: { assetId: state.asset.id },
  });

  assert.equal(state.asset.parsingStatus, 'COMPLETED');
  assert.equal(state.candidate.currentTitle, 'Senior Angular Developer');
  assert.equal(state.candidate.currentEmployer, 'Careeriz Labs');
  assert.equal(state.candidate.location, 'Bengaluru, Karnataka, India');
  assert.equal(state.candidate.currentCity, 'Bengaluru');
  assert.equal(state.candidate.currentState, 'Karnataka');
  assert.equal(state.candidate.currentCountry, 'India');
  assert.deepEqual(state.candidate.certificationEntries.map((entry) => entry.name).sort(), [
    'AWS Certified Developer - Associate',
    'Anaplan Certified Model Builder',
  ].sort());
  assert.equal(state.candidate.skills.includes('Angular'), true);
  assert.equal(state.candidate.skills.includes('Lazy Loading'), true);
  assert.equal(state.candidate.skills.includes('Languages & Frameworks: Angular 11+'), false);
  assert.equal(state.asset.parsedData.appliedFields.length > 0, true);
  assert.equal(state.asset.parsedData.appliedFields.includes('currentTitle'), true);
  assert.equal(state.asset.parsedData.appliedFields.includes('currentEmployer'), true);
});

test('RESUME_PARSING preserves valid manual values and records a suggestion for real conflicts', async () => {
  seedCandidate({
    currentTitle: 'Staff Frontend Engineer',
    phoneNumber: '+91 9888877776',
    normalizedPhoneNumber: '+919888877776',
  });
  seedResumeAsset();

  const resumeBuffer = await bufferFromPdf({
    text: [
      'Jane Candidate',
      'Frontend Developer',
      'Pune, Maharashtra, India',
      'jane@example.com',
      '+91 9888877775',
      'Skills',
      'React, Next.js, TypeScript',
    ].join('\n'),
  });
  state.asset.sizeBytes = resumeBuffer.length;
  writeStoredResume(state.asset.storageKey, resumeBuffer);

  await processBackgroundTask({
    id: 'task-manual-preserve-suggestion',
    type: 'RESUME_PARSING',
    entityId: state.asset.id,
    payload: { assetId: state.asset.id },
  });

  assert.equal(state.candidate.currentTitle, 'Staff Frontend Engineer');
  assert.equal(state.candidate.phoneNumber, '+91 9888877776');
  assert.equal(state.asset.parsedData.suggestedUpdates.phoneNumber.resumeValue, '+91 9888877775');
  assert.equal(state.asset.parsedData.suggestedUpdates.phoneNumber.currentValue, '+91 9888877776');
});

test('RESUME_PARSING merges skills without duplicates', async () => {
  seedCandidate({
    skills: ['React', 'Node.js'],
  });
  seedResumeAsset();

  const resumeBuffer = await bufferFromPdf({
    text: [
      'Skill Merge Person',
      'skill.merge@example.com',
      'Skills',
      'React, AWS, Node.js, Docker',
    ].join('\n'),
  });
  state.asset.sizeBytes = resumeBuffer.length;
  writeStoredResume(state.asset.storageKey, resumeBuffer);

  await processBackgroundTask({
    id: 'task-3',
    type: 'RESUME_PARSING',
    entityId: state.asset.id,
    payload: { assetId: state.asset.id },
  });

  assert.deepEqual(state.candidate.skills.sort(), ['AWS', 'Docker', 'Node.js', 'React'].sort());
});

test('RESUME_PARSING marks image-only resumes as FAILED and preserves the candidate profile', async () => {
  const candidate = seedCandidate({
    fullName: 'Manual Candidate',
    currentTitle: 'Backend Engineer',
    skills: ['Java'],
  });
  seedResumeAsset();
  const before = clone(candidate);

  const resumeBuffer = await bufferFromPdf();
  state.asset.sizeBytes = resumeBuffer.length;
  writeStoredResume(state.asset.storageKey, resumeBuffer);

  await processBackgroundTask({
    id: 'task-4',
    type: 'RESUME_PARSING',
    entityId: state.asset.id,
    payload: { assetId: state.asset.id },
  });

  assert.equal(state.asset.parsingStatus, 'FAILED');
  assert.equal(state.asset.parsedData.errorCode, 'PDF_IMAGE_ONLY');
  assert.match(state.asset.parsedData.errorMessage, /could not extract meaningful text/i);
  assert.equal(state.candidate.fullName, before.fullName);
  assert.equal(state.candidate.currentTitle, before.currentTitle);
  assert.deepEqual(state.candidate.skills, before.skills);
});

test('RESUME_PARSING sanitizes NUL bytes from resume-derived fields before persistence', async () => {
  seedCandidate();
  seedResumeAsset({
    originalFilename: 'candidate-resume.doc',
    storageKey: 'resumes/2026/08/test-resume.doc',
    mimeType: 'application/msword',
  });

  const legacyDocBuffer = Buffer.from('John\u0000 Doe\u0000\nSenior\u0000 Engineer at Acme\u0000\njohn.doe@example.com\u0000\nSkills\u0000\nReact\u0000, Node.js\u0000', 'utf16le');
  state.asset.sizeBytes = legacyDocBuffer.length;
  writeStoredResume(state.asset.storageKey, legacyDocBuffer);

  const result = await processBackgroundTask({
    id: 'task-5',
    type: 'RESUME_PARSING',
    entityId: state.asset.id,
    payload: { assetId: state.asset.id },
  });

  assert.equal(result, 'success');
  assert.equal(state.asset.parsingStatus, 'COMPLETED');
  assert.equal(state.candidate.fullName.includes('\u0000'), false);
  assert.equal(state.candidate.rawResumeText.includes('\u0000'), false);
  assert.equal(JSON.stringify(state.asset.parsedData).includes('\\u0000'), false);
  assert.equal(JSON.stringify(state.candidate.parserMetadata).includes('\\u0000'), false);
  assert.equal(state.candidate.email, 'john.doe@example.com');
});

test('RESUME_PARSING classifies experience, projects, certifications, and languages without leaking declaration text', async () => {
  seedCandidate();
  seedResumeAsset();

  const resumeBuffer = await bufferFromPdf({
    text: [
      'Arun Kumar',
      'Senior Full Stack Engineer',
      'Bengaluru, Karnataka, India',
      'arun@example.com',
      'Summary',
      'Engineer with 7 years of experience in fintech platforms.',
      'Skills',
      'React, Node.js, AWS, Docker, PostgreSQL, Agile',
      'Experience',
      'Senior Full Stack Engineer at Acme Bank',
      'Jan 2022 - Present',
      'Project: Digital Lending Platform',
      'Domain: Fintech',
      'Responsibilities: Built customer onboarding flows and API integrations.',
      'Technologies: React, Node.js, AWS, PostgreSQL',
      'Projects',
      'Digital Lending Platform',
      'Role: Technical Lead',
      'Company: Acme Bank',
      'Duration: Jan 2022 - Present',
      'Domain: Fintech',
      'Technologies: React, Node.js, AWS, PostgreSQL',
      'Description: Built onboarding and underwriting workflows.',
      'Education',
      'B.Tech in Computer Science',
      'Visvesvaraya Technological University',
      '2015 - 2019',
      'CGPA: 8.4',
      'Certifications',
      'Anaplan Certified Model Builder',
      'AWS Certified Developer - Associate',
      'Languages',
      'English - Fluent',
      'Hindi - Native / Bilingual',
      'Personal Details',
      'Father Name: Ramesh Kumar',
      'Declaration: I hereby declare that the above information is true.',
    ].join('\n'),
  });
  state.asset.sizeBytes = resumeBuffer.length;
  writeStoredResume(state.asset.storageKey, resumeBuffer);

  await processBackgroundTask({
    id: 'task-6',
    type: 'RESUME_PARSING',
    entityId: state.asset.id,
    payload: { assetId: state.asset.id },
  });

  assert.equal(state.asset.parsingStatus, 'COMPLETED');
  assert.equal(state.candidate.experienceEntries.length >= 1, true);
  assert.equal(state.candidate.experienceEntries[0].company, 'Acme Bank');
  assert.equal(state.candidate.projectEntries.length, 1);
  assert.equal(state.candidate.projectEntries[0].projectName, 'Digital Lending Platform');
  assert.deepEqual(state.candidate.certificationEntries.map((item) => item.name).sort(), ['AWS Certified Developer - Associate', 'Anaplan Certified Model Builder'].sort());
  assert.equal(state.candidate.certificationEntries.some((item) => /Declaration|Responsibilities|Acme Bank/i.test(item.name)), false);
  assert.equal(state.candidate.languageEntries.length, 2);
  assert.equal(state.candidate.languageEntries[0].language, 'English');
  assert.equal(state.candidate.languageEntries[0].proficiency, 'Fluent');
});

test('RESUME_PARSING uses the configured intelligence provider when available', async () => {
  seedCandidate();
  seedResumeAsset();
  env.intelligenceEnabled = true;
  env.intelligenceProvider = 'OPENAI';
  env.intelligenceModel = 'gpt-test';
  resetIntelligenceProvider();

  global.fetch = async () => ({
    ok: true,
    text: async () => JSON.stringify({
      model: 'gpt-test',
      choices: [{
        message: {
          content: JSON.stringify({
            candidate: {
              fullName: { value: 'AI Resume Person', confidence: 0.95 },
              currentTitle: { value: 'AI Engineer', confidence: 0.92 },
              currentEmployer: { value: 'Careeriz Labs', confidence: 0.9 },
              skills: { value: ['React', 'Node.js'], confidence: 0.87 },
            },
            metadata: {
              parser: 'careeriz-openai-test',
              },
            }),
          },
        }],
      }),
  });

  const resumeBuffer = await bufferFromPdf({
    text: [
      'AI Resume Person',
      'AI Engineer',
      'Careeriz Labs',
      'Skills',
      'React, Node.js',
    ].join('\n'),
  });
  state.asset.sizeBytes = resumeBuffer.length;
  writeStoredResume(state.asset.storageKey, resumeBuffer);

  await processBackgroundTask({
    id: 'task-ai-success',
    type: 'RESUME_PARSING',
    entityId: state.asset.id,
    payload: { assetId: state.asset.id },
  });

  assert.equal(state.asset.parsingStatus, 'COMPLETED');
  assert.equal(state.asset.parsedData.aiProvider, true);
  assert.equal(state.asset.parsedData.provider, 'openai');
  assert.equal(state.candidate.currentTitle, 'AI Engineer');
  assert.equal(state.candidate.currentEmployer, 'Careeriz Labs');
});

test('RESUME_PARSING falls back safely when the AI provider fails and marks the result for review', async () => {
  seedCandidate();
  seedResumeAsset();
  env.intelligenceEnabled = true;
  env.intelligenceProvider = 'OPENAI';
  env.intelligenceModel = 'gpt-test';
  resetIntelligenceProvider();

  global.fetch = async () => {
    const error = new Error('Provider unavailable');
    error.code = 'INTELLIGENCE_PROVIDER_ERROR';
    throw error;
  };

  const resumeBuffer = await bufferFromPdf({
    text: [
      'Fallback Resume Person',
      'fallback.resume@example.com',
      '+91 9988776655',
      'Skills',
      'React, Node.js',
    ].join('\n'),
  });
  state.asset.sizeBytes = resumeBuffer.length;
  writeStoredResume(state.asset.storageKey, resumeBuffer);

  await processBackgroundTask({
    id: 'task-ai-fallback',
    type: 'RESUME_PARSING',
    entityId: state.asset.id,
    payload: { assetId: state.asset.id },
  });

  assert.equal(state.asset.parsingStatus, 'PARTIAL');
  assert.equal(state.asset.parsedData.aiProvider, false);
  assert.equal(state.asset.parsedData.aiFallbackReason, 'INTELLIGENCE_PROVIDER_ERROR');
  assert.equal(state.candidate.email, 'fallback.resume@example.com');
});

test('RESUME_PARSING marks corrupted extracted resume text for review and skips profile updates', async () => {
  const before = seedCandidate({
    fullName: 'Manual Candidate',
    currentTitle: 'Staff Engineer',
    location: 'Chennai, Tamil Nadu, India',
  });
  seedResumeAsset({
    originalFilename: 'failing-resume.doc',
    storageKey: 'resumes/2026/08/failing-resume.doc',
    mimeType: 'application/msword',
  });

  const corruptedBuffer = Buffer.from('("63"7,6."3 108&3#*%&7&-01&3 E-Mail: candidate@example.com Environment Setup Task Performed Declaration', 'utf8');
  state.asset.sizeBytes = corruptedBuffer.length;
  writeStoredResume(state.asset.storageKey, corruptedBuffer);

  await processBackgroundTask({
    id: 'task-7',
    type: 'RESUME_PARSING',
    entityId: state.asset.id,
    payload: { assetId: state.asset.id },
  });

  assert.equal(state.asset.parsingStatus, 'FAILED');
  assert.equal(state.asset.parsedData.errorCode, 'DOC_TEXT_LOW_QUALITY');
  assert.match(state.asset.parsedData.errorMessage, /low-quality resume text extraction/i);
  assert.equal(state.candidate.fullName, before.fullName);
  assert.equal(state.candidate.currentTitle, before.currentTitle);
  assert.equal(state.candidate.location, before.location);
});

test('profile presentation normalization hides polluted values from the rendered candidate profile', () => {
  const normalized = normalizeCandidateProfileForPresentation(seedCandidate({
    headline: 'E-Mail:',
    currentTitle: 'E-Mail:',
    location: '("63"7,6."3 108&3#*%&7&-01&3 massive corrupted extracted text',
    educationEntries: [{ degree: 'DETAILS', institution: 'Training & Education Details' }],
    certificationEntries: [
      { name: 'Work Experience' },
      { name: 'Organization: Cognizant India' },
      { name: 'Anaplan Certified Model Builder' },
    ],
  }));

  assert.equal(normalized.headline, null);
  assert.equal(normalized.currentTitle, null);
  assert.equal(normalized.location, null);
  assert.deepEqual(normalized.educationEntries, []);
  assert.deepEqual(normalized.certificationEntries.map((entry) => entry.name), ['Anaplan Certified Model Builder']);
  assert.equal(calculateProfileCompletion(normalized).percentage < calculateProfileCompletion({
    ...normalized,
    currentTitle: 'Senior Engineer',
    location: 'Bengaluru, Karnataka, India',
    skills: ['React', 'AWS', 'Node.js'],
  }).percentage, true);
});

test('RESUME_PARSING accepts the local naukri_aditigarg regression PDF and applies parsed profile data', async () => {
  seedCandidate();
  seedResumeAsset({
    originalFilename: 'naukri_aditigarg-7y_0m.pdf',
    storageKey: 'resumes/2026/08/naukri_aditigarg-7y_0m.pdf',
    mimeType: 'application/pdf',
  });

  const sourcePath = path.resolve(process.cwd(), 'storage/resumes/resumes/2026/08/9a75e7a7-c2a9-4969-af5c-f56460728227-naukri_aditigarg-7y_0m.pdf');
  const resumeBuffer = fs.readFileSync(sourcePath);
  state.asset.sizeBytes = resumeBuffer.length;
  writeStoredResume(state.asset.storageKey, resumeBuffer);

  await processBackgroundTask({
    id: 'task-aditigarg',
    type: 'RESUME_PARSING',
    entityId: state.asset.id,
    payload: { assetId: state.asset.id },
  });

  assert.notEqual(state.asset.parsingStatus, 'FAILED');
  assert.match(state.candidate.fullName || '', /Aditi Garg/i);
  assert.equal(Array.isArray(state.candidate.skills), true);
  assert.equal(state.candidate.skills.length > 0, true);
  assert.equal(Array.isArray(state.candidate.experienceEntries), true);
  assert.equal(state.candidate.experienceEntries.length > 0, true);
});
