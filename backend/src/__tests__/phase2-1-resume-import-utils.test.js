import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import PDFDocument from 'pdfkit';

let env;
let validateUploadedResumeFile;
let expandResumeArchive;
let extractResumeText;
let parseResumeText;
let buildDeterministicResumeParse;
let sanitizeResumeData;
let sanitizeResumeString;
let assessResumeTextQuality;
let sanitizeCertificationEntries;
let buildCandidateProfileRepairData;
let resetIntelligenceProvider;

function bufferFromPdf({ text = null } = {}) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 32 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    if (text) {
      doc.text(text);
    } else {
      doc.addPage();
    }
    doc.end();
  });
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipDateParts() {
  return { time: 0, date: 0 };
}

function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    const dataBuffer = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data || '');
    const { time, date } = zipDateParts();
    const flags = entry.encrypted ? 0x1 : 0x0;
    const compressionMethod = 0;
    const crc = crc32(dataBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(flags, 6);
    localHeader.writeUInt16LE(compressionMethod, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, dataBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(flags, 8);
    centralHeader.writeUInt16LE(compressionMethod, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + dataBuffer.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endRecord]);
}

function buildMinimalDocx(text) {
  return buildZip([
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    },
    {
      name: 'word/document.xml',
      data: `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${text}</w:t></w:r></w:p>
  </w:body>
</w:document>`,
    },
  ]);
}

before(async () => {
  ({ env } = await import('../config/env.js'));
  ({ validateUploadedResumeFile, expandResumeArchive, extractResumeText, sanitizeResumeData, sanitizeResumeString, buildDeterministicResumeParse, assessResumeTextQuality } = await import('../services/resumeImportUtils.js'));
  ({ parseResumeText } = await import('../services/ai/resume-parser.js'));
  ({ sanitizeCertificationEntries, buildCandidateProfileRepairData } = await import('../services/candidateProfileSanitizer.js'));
  ({ resetIntelligenceProvider } = await import('../intelligence/services/providerService.js'));
});

beforeEach(() => {
  env.resumeMaxFileSizeMb = 10;
  env.resumeImportMaxFiles = 100;
  env.resumeImportMaxZipSizeMb = 100;
  env.resumeImportMaxUncompressedMb = 500;
  env.resumeImportMaxTextChars = 120000;
  env.aiResumeParsingEnabled = false;
  env.aiProvider = 'disabled';
  env.intelligenceEnabled = false;
  env.intelligenceProvider = 'DISABLED';
  env.intelligenceModel = null;
  env.intelligenceBaseUrl = 'https://example.test';
  env.intelligenceApiKey = 'test-key';
  resetIntelligenceProvider();
  global.fetch = undefined;
});

test('resume upload validation accepts PDF and rejects unsupported or oversized files', async () => {
  const pdfBuffer = await bufferFromPdf({ text: 'John Doe john@example.com +91 9999999999' });
  const valid = await validateUploadedResumeFile({
    originalname: 'John_Doe.pdf',
    mimetype: 'application/pdf',
    size: pdfBuffer.length,
    buffer: pdfBuffer,
  });

  assert.equal(valid.extension, '.pdf');
  assert.equal(valid.sanitizedFilename, 'john_doe.pdf');

  await assert.rejects(
    () => validateUploadedResumeFile({
      originalname: 'malware.exe',
      mimetype: 'application/octet-stream',
      size: 12,
      buffer: Buffer.from('boom'),
    }),
    /Unsupported file type/
  );

  env.resumeMaxFileSizeMb = 1;
  await assert.rejects(
    () => validateUploadedResumeFile({
      originalname: 'large.pdf',
      mimetype: 'application/pdf',
      size: (2 * 1024 * 1024) + 1,
      buffer: Buffer.alloc((2 * 1024 * 1024) + 1, 1),
    }),
    /File exceeds/
  );
});

test('archive validation rejects traversal, nested ZIP, encrypted ZIP, corrupt ZIP, and uncompressed size bombs', async () => {
  const docxBuffer = buildMinimalDocx('Jane Doe');

  await assert.rejects(
    () => expandResumeArchive({
      originalname: 'traversal.zip',
      mimetype: 'application/zip',
      size: 0,
      buffer: buildZip([{ name: '../evil.pdf', data: Buffer.from('x') }]),
    }),
    /(unsafe path|invalid relative path)/i
  );

  await assert.rejects(
    () => expandResumeArchive({
      originalname: 'nested.zip',
      mimetype: 'application/zip',
      size: 0,
      buffer: buildZip([{ name: 'nested.zip', data: Buffer.from('fake') }]),
    }),
    /Nested ZIP/i
  );

  await assert.rejects(
    () => expandResumeArchive({
      originalname: 'encrypted.zip',
      mimetype: 'application/zip',
      size: 0,
      buffer: buildZip([{ name: 'resume.docx', data: docxBuffer, encrypted: true }]),
    })
  );

  env.resumeImportMaxUncompressedMb = 1;
  await assert.rejects(
    () => expandResumeArchive({
      originalname: 'bomb.zip',
      mimetype: 'application/zip',
      size: 0,
      buffer: buildZip([{ name: 'resume.docx', data: Buffer.alloc((1024 * 1024) + 8, 1) }]),
    }),
    /maximum uncompressed size/i
  );

  await assert.rejects(
    () => expandResumeArchive({
      originalname: 'corrupt.zip',
      mimetype: 'application/zip',
      size: 9,
      buffer: Buffer.from('not-a-zip'),
    }),
    /could not be opened/i
  );
});

test('archive expansion accepts valid DOCX entries', async () => {
  const docxBuffer = buildMinimalDocx('Alice Example');
  const zipBuffer = buildZip([{ name: 'Alice Example.docx', data: docxBuffer }]);
  const files = await expandResumeArchive({
    originalname: 'resumes.zip',
    mimetype: 'application/zip',
    size: zipBuffer.length,
    buffer: zipBuffer,
  });

  assert.equal(files.length, 1);
  assert.equal(files[0].extension, '.docx');
  assert.equal(files[0].sanitizedFilename, 'alice-example.docx');
});

test('resume text extraction handles text PDFs, image-only PDFs, DOCX files, and legacy DOC fallback extraction', async () => {
  const pdfText = await extractResumeText({
    extension: '.pdf',
    fileBuffer: await bufferFromPdf({ text: 'John Doe john@example.com +91 9999999999' }),
  });
  assert.match(pdfText.text, /John Doe/);
  assert.equal(pdfText.requiresManualReview, false);

  const imageOnly = await extractResumeText({
    extension: '.pdf',
    fileBuffer: await bufferFromPdf(),
  });
  assert.equal(imageOnly.errorCode, 'PDF_IMAGE_ONLY');
  assert.equal(imageOnly.requiresManualReview, true);

  const docx = await extractResumeText({
    extension: '.docx',
    fileBuffer: buildMinimalDocx('Docx Candidate'),
  });
  assert.match(docx.text, /Docx Candidate/);
  assert.equal(docx.requiresManualReview, false);

  const doc = await extractResumeText({
    extension: '.doc',
    fileBuffer: Buffer.from('legacy-doc'),
  });
  assert.match(doc.text, /legacy-doc/i);
  assert.equal(doc.requiresManualReview, false);
});

test('resume quality assessment does not reject readable PDFs with normal punctuation and achievement text', async () => {
  const readableResumeText = [
    'ADITI GARG',
    'Front-End Developer with 6+ years of experience in building and optimizing dynamic, user-centric web applications.',
    'Delhi, India',
    '+91-8684966979',
    'garg.aditi261997@gmail.com',
    'LinkedIn: https://www.linkedin.com/in/garg-aditi/',
    'TECHNICAL SKILLS',
    'Angular, RxJS, TypeScript, JavaScript (ES6+), HTML5, CSS3, SCSS, Bootstrap, Highcharts',
    'CERTIFICATIONS',
    'Angular Core Deep Dive - Beginner to Advanced (v16)',
    'ACHIEVEMENTS',
    "Top Performer's Award (Q2) and Spot Award (Q4) for Angular module development.",
    'Reduced bug resolution time by 30% by implementing better debugging and testing strategies.',
  ].join('\n');

  const quality = assessResumeTextQuality(readableResumeText);

  assert.equal(quality.usable, true);
  assert.equal(quality.reasons.includes('BROKEN_CHARACTER_ENCODING'), false);
});

test('AI-disabled parsing falls back deterministically and mock provider stays structured', async () => {
  env.aiResumeParsingEnabled = false;
  env.aiProvider = 'disabled';

  const deterministic = await parseResumeText(
    'Resume Person\nresume.person@example.com\n+1 555 123 4567\nhttps://www.linkedin.com/in/resume-person',
    { originalFilename: 'resume-person.pdf' }
  );
  assert.equal(deterministic.candidate.email.value, 'resume.person@example.com');
  assert.equal(deterministic.candidate.fullName.value, 'Resume Person');

  env.aiResumeParsingEnabled = true;
  env.aiProvider = 'mock';

  const mockParsed = await parseResumeText('Only a name line', { originalFilename: 'mock-candidate.pdf' });
  assert.equal(mockParsed.candidate.fullName.value, 'Only a name line');
  assert.deepEqual(mockParsed.candidate.skills.value, []);
});

test('intelligence-provider parsing invokes the configured AI provider and merges structured resume data', async () => {
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
              fullName: { value: 'Resume Person', confidence: 0.96 },
              currentTitle: { value: 'Senior Engineer', confidence: 0.93 },
              currentEmployer: { value: 'Careeriz Labs', confidence: 0.91 },
              skills: { value: ['React', 'Node.js'], confidence: 0.88 },
              experienceEntries: {
                value: [{ company: 'Careeriz Labs', title: 'Senior Engineer', startDate: '2024-01', endDate: null }],
                confidence: 0.86,
              },
            },
            metadata: {
              parser: 'careeriz-openai-test',
            },
          }),
        },
      }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
      },
    }),
  });

  const parsed = await parseResumeText(
    'Resume Person\nSenior Engineer\nCareeriz Labs\nSkills\nReact, Node.js',
    { originalFilename: 'resume-person.pdf' }
  );

  assert.equal(parsed.metadata.aiProvider, true);
  assert.equal(parsed.metadata.provider, 'openai');
  assert.equal(parsed.metadata.model, 'gpt-test');
  assert.equal(parsed.metadata.parserVersion, '3.0.0');
  assert.equal(parsed.metadata.parser, 'careeriz-resume-parser-v3');
  assert.equal(parsed.metadata.stages.aiCompleted, true);
  assert.equal(parsed.candidate.currentTitle.value, 'Senior Engineer');
  assert.equal(parsed.candidate.currentEmployer.value, 'Careeriz Labs');
  assert.deepEqual(parsed.candidate.skills.value, ['React', 'Node.js']);
  assert.equal(Array.isArray(parsed.candidate.experienceEntries.value), true);
});

test('AI provider failure falls back to deterministic parsing and records fallback metadata', async () => {
  env.intelligenceEnabled = true;
  env.intelligenceProvider = 'OPENAI';
  env.intelligenceModel = 'gpt-test';
  resetIntelligenceProvider();

  global.fetch = async () => {
    const error = new Error('Provider unavailable');
    error.code = 'INTELLIGENCE_PROVIDER_ERROR';
    throw error;
  };

  const parsed = await parseResumeText(
    'Resume Person\nresume.person@example.com\n+1 555 123 4567\nhttps://www.linkedin.com/in/resume-person',
    { originalFilename: 'resume-person.pdf' }
  );

  assert.equal(parsed.metadata.aiProvider, false);
  assert.equal(parsed.metadata.aiRequested, true);
  assert.equal(parsed.metadata.provider, 'openai');
  assert.equal(parsed.metadata.parserVersion, '3.0.0');
  assert.equal(parsed.metadata.stages.aiCompleted, false);
  assert.equal(parsed.metadata.aiFallbackReason, 'INTELLIGENCE_PROVIDER_ERROR');
  assert.equal(parsed.candidate.email.value, 'resume.person@example.com');
  assert.equal(parsed.candidate.fullName.value, 'Resume Person');
});

test('resume parsing requests a 4000-token completion budget from the AI provider', async () => {
  env.intelligenceEnabled = true;
  env.intelligenceProvider = 'OPENAI';
  env.intelligenceModel = 'gpt-5';
  resetIntelligenceProvider();

  let requestBody = null;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      text: async () => JSON.stringify({
        model: 'gpt-5',
        choices: [{ message: { content: JSON.stringify({ candidate: { fullName: { value: 'Resume Person', confidence: 0.9 } } }) }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    };
  };

  await parseResumeText('Resume Person\nresume.person@example.com', { originalFilename: 'resume-person.pdf' });

  assert.equal(requestBody.max_completion_tokens, 4000);
});

test('a truncated (finish_reason=length) or empty AI response is treated as incomplete, not a valid empty answer', async () => {
  env.intelligenceEnabled = true;
  env.intelligenceProvider = 'OPENAI';
  env.intelligenceModel = 'gpt-test';
  env.intelligenceMaxRetries = 0;
  resetIntelligenceProvider();

  global.fetch = async () => ({
    ok: true,
    text: async () => JSON.stringify({
      model: 'gpt-test',
      choices: [{ message: { content: '' }, finish_reason: 'length' }],
      usage: { prompt_tokens: 10, completion_tokens: 4000 },
    }),
  });

  const parsed = await parseResumeText(
    'Resume Person\nresume.person@example.com\n+1 555 123 4567',
    { originalFilename: 'resume-person.pdf' }
  );

  assert.equal(parsed.metadata.aiProvider, false, 'a truncated/empty response must not be reported as a completed AI parse');
  assert.equal(parsed.metadata.aiFallbackReason, 'INTELLIGENCE_INCOMPLETE_OUTPUT');
  // Deterministic extraction must still be the source of truth for the fallback result.
  assert.equal(parsed.candidate.email.value, 'resume.person@example.com');
});

test('invalid or non-JSON AI output is never merged into candidate data — deterministic fallback wins instead', async () => {
  env.intelligenceEnabled = true;
  env.intelligenceProvider = 'OPENAI';
  env.intelligenceModel = 'gpt-test';
  resetIntelligenceProvider();

  global.fetch = async () => ({
    ok: true,
    text: async () => JSON.stringify({
      model: 'gpt-test',
      choices: [{ message: { content: 'this is not valid JSON at all {{{' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    }),
  });

  const parsed = await parseResumeText(
    'Resume Person\nresume.person@example.com\n+1 555 123 4567',
    { originalFilename: 'resume-person.pdf' }
  );

  assert.equal(parsed.metadata.aiProvider, false, 'invalid JSON must never be reported as a completed/merged AI parse');
  assert.equal(parsed.metadata.aiFallbackReason, 'AI_INVALID_JSON');
  assert.equal(parsed.candidate.email.value, 'resume.person@example.com');
  assert.equal(parsed.candidate.fullName.value, 'Resume Person');
});

test('a provider timeout safely falls back to deterministic parsing and records INTELLIGENCE_TIMEOUT as the fallback reason', async () => {
  env.intelligenceEnabled = true;
  env.intelligenceProvider = 'OPENAI';
  env.intelligenceModel = 'gpt-test';
  env.intelligenceTimeoutMs = 30;
  env.intelligenceMaxRetries = 0;
  resetIntelligenceProvider();

  global.fetch = async () => new Promise(() => {}); // never resolves -> forces the provider's own timeout

  const parsed = await parseResumeText(
    'Resume Person\nresume.person@example.com\n+1 555 123 4567',
    { originalFilename: 'resume-person.pdf' }
  );

  assert.equal(parsed.metadata.aiProvider, false);
  assert.equal(parsed.metadata.stages.aiCompleted, false);
  assert.equal(parsed.metadata.aiFallbackReason, 'INTELLIGENCE_TIMEOUT');
  assert.equal(parsed.candidate.email.value, 'resume.person@example.com');
  assert.equal(parsed.candidate.fullName.value, 'Resume Person');
});

test('resume sanitization recursively removes NUL and unsafe control characters from nested parsed data', () => {
  const sanitized = sanitizeResumeData({
    fullName: 'Jane\u0000 Doe',
    summary: 'Line 1\u0007\nLine 2\tTabbed\rCarriage',
    experienceEntries: [
      { title: 'Senior\u0000 Engineer', company: 'Acme\u0000' },
      'Skill\u0000A',
    ],
    metadata: {
      provider: 'mock\u0000-provider',
      nested: {
        note: 'Hello\u0001World',
      },
    },
    totalExperience: 5,
    active: true,
    nullable: null,
  });

  assert.deepEqual(sanitized, {
    fullName: 'Jane Doe',
    summary: 'Line 1\nLine 2\tTabbed\rCarriage',
    experienceEntries: [
      { title: 'Senior Engineer', company: 'Acme' },
      'SkillA',
    ],
    metadata: {
      provider: 'mock-provider',
      nested: {
        note: 'HelloWorld',
      },
    },
    totalExperience: 5,
    active: true,
    nullable: null,
  });
});

test('resume sanitization preserves normal Unicode characters and useful whitespace', () => {
  const sanitized = sanitizeResumeString('Jöhn Dœ\nRésumé\t東京\u0000');
  assert.equal(sanitized, 'Jöhn Dœ\nRésumé\t東京');
});
test('extraction quality rejects corrupted failing-resume text before profile parsing', () => {
  const corrupted = '("63"7,6."3 108&3#*%&7&-01&3 E-Mail: candidate@example.com Environment Setup Task Performed Declaration';
  const quality = assessResumeTextQuality(corrupted);

  assert.equal(quality.usable, false);
  assert.equal(quality.reasons.includes('GIBBERISH_TOKEN_SEQUENCES') || quality.reasons.includes('BROKEN_CHARACTER_ENCODING'), true);
});

test('deterministic parsing rejects label values and corrupted scalar fields from failing resume output', () => {
  const parsed = buildDeterministicResumeParse([
    'Candidate Name',
    'E-Mail:',
    'candidate@example.com',
    '("63"7,6."3 108&3#*%&7&-01&3',
    'Professional Experience',
    'Senior Engineer at Acme Corp',
    'Jan 2021 - Present',
    'Projects',
    'Incentive Compensation Management',
    'Role: Technical Lead',
    'Company: Acme Corp',
    'Description: Built planning workflows.',
    'Education',
    'DETAILS',
    'B.Tech in Computer Science',
    'VTU',
    '2018',
    'Certifications',
    'Work Experience',
    'Acme Corp',
    'Responsibilities: Managed models',
    'Anaplan Certified Model Builder',
    'Personal Details',
    'Declaration: I hereby declare that the above information is true.',
  ].join('\n'), 'failing-resume.pdf');

  assert.notEqual(parsed.candidate.currentTitle.value, 'E-Mail:');
  assert.notEqual(parsed.candidate.headline.value, 'E-Mail:');
  assert.notEqual(parsed.candidate.location.value, '("63"7,6."3 108&3#*%&7&-01&3');
  assert.equal(parsed.candidate.educationEntries.value.some((entry) => entry.degree === 'DETAILS'), false);
  assert.equal(parsed.candidate.certificationEntries.value.some((entry) => /Work Experience|Acme Corp|Responsibilities|Declaration/i.test(entry.name)), false);
  assert.equal(parsed.candidate.certificationEntries.value.some((entry) => /Anaplan Certified Model Builder/i.test(entry.name)), true);
  assert.equal(parsed.candidate.experienceEntries.value.length >= 1, true);
  assert.equal(parsed.candidate.projectEntries.value.length >= 1, true);
});

test('deterministic parsing keeps section boundaries strict across structured resume sections', () => {
  const parsed = buildDeterministicResumeParse([
    'Arun Kumar',
    'Senior Full Stack Engineer',
    'Bengaluru, Karnataka, India',
    'arun@example.com',
    '+91 9876543210',
    'https://www.linkedin.com/in/arunkumar',
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
    '',
    'Software Engineer at Orbit Systems',
    'Jun 2019 - Dec 2021',
    'Responsibilities: Developed internal tools for operations teams.',
    'Technologies: JavaScript, SQL',
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
  ].join('\n'), 'arun-kumar.pdf');

  assert.equal(parsed.candidate.experienceEntries.value.length >= 2, true);
  assert.equal(parsed.candidate.experienceEntries.value[0].company, 'Acme Bank');
  assert.equal(parsed.candidate.experienceEntries.value[0].project, 'Digital Lending Platform');
  assert.equal(parsed.candidate.projectEntries.value.length, 1);
  assert.equal(parsed.candidate.projectEntries.value[0].projectName, 'Digital Lending Platform');
  assert.equal(parsed.candidate.educationEntries.value.length, 1);
  assert.equal(parsed.candidate.educationEntries.value[0].degree, 'B.Tech in Computer Science');
  assert.equal(parsed.candidate.certificationEntries.value.map((item) => item.name).sort().join('|'), 'AWS Certified Developer - Associate|Anaplan Certified Model Builder');
  assert.equal(parsed.candidate.certificationEntries.value.some((item) => /Responsibilities|Declaration|Acme Bank/i.test(item.name)), false);
  assert.equal(parsed.candidate.languageEntries.value.length, 2);
  assert.equal(parsed.candidate.languageEntries.value[0].language, 'English');
  assert.equal(parsed.candidate.languageEntries.value[0].proficiency, 'Fluent');
  assert.equal(parsed.candidate.skills.value.includes('React'), true);
  assert.equal(parsed.candidate.tools.value.includes('Docker'), true);
  assert.equal(parsed.candidate.cloudPlatforms.value.includes('AWS'), true);
  assert.equal(parsed.candidate.functionalSkills.value.includes('Agile'), true);
  assert.deepEqual(parsed.candidate.portfolioLinks.value, []);
});

test('strict certification sanitization rejects contamination and keeps only real credentials', () => {
  const { entries, contaminated } = sanitizeCertificationEntries([
    { name: 'Work Experience' },
    { name: 'Organization: Cognizant India' },
    { name: 'Project: Incentive Compensation Management' },
    { name: 'Environment Setup' },
    { name: 'SQL' },
    { name: 'Anaplan Certified Model Builder' },
    { name: 'AWS Certified Developer - Associate' },
  ]);

  assert.equal(contaminated, false);
  assert.deepEqual(entries.map((entry) => entry.name).sort(), [
    'AWS Certified Developer - Associate',
    'Anaplan Certified Model Builder',
  ].sort());
});

test('candidate profile repair data clears polluted parser values while preserving valid manual fields', () => {
  const repair = buildCandidateProfileRepairData({
    id: 'candidate-1',
    fullName: 'Test Candidate',
    phoneNumber: '+91 9999999999',
    headline: 'E-Mail:',
    currentTitle: 'E-Mail:',
    currentEmployer: 'Pune, India',
    currentDesignation: 'Senior Engineer',
    location: '("63"7,6."3 108&3#*%&7&-01&3 massive corrupted text',
    currentCity: 'optimizing dynamic',
    currentState: 'user-centric web applications using Angular',
    currentCountry: 'RxJS',
    skills: ['React', 'AWS'],
    educationEntries: [{ degree: 'DETAILS', institution: 'Training & Education Details' }, { degree: 'B.Tech Computer Science', institution: 'VTU' }],
    certificationEntries: [{ name: 'Work Experience' }, { name: 'Anaplan Certified Model Builder' }],
    experienceEntries: [{ title: 'Project:', company: 'Organization:', summary: 'Declaration' }, { title: 'Software Engineer', company: 'Acme Corp', summary: 'Built products.' }],
    projectEntries: [{ projectName: 'Project', summary: 'Declaration' }, { projectName: 'Usage Monitoring Dashboard', summary: 'Built monitoring flows.' }],
    languageEntries: [{ language: 'Declaration', proficiency: 'Fluent' }, { language: 'English', proficiency: 'Fluent', speak: true }],
  });

  assert.equal(repair.currentTitle, null);
  assert.equal(repair.headline, null);
  assert.equal(repair.currentEmployer, null);
  assert.equal(repair.location, null);
  assert.equal(repair.currentCity, null);
  assert.equal(repair.currentState, null);
  assert.equal(repair.currentCountry, null);
  assert.deepEqual(repair.certificationEntries, [{ name: 'Anaplan Certified Model Builder', issuingOrganisation: null, issueDate: null, expiryDate: null, credentialId: null, credentialUrl: null }]);
  assert.equal(repair.educationEntries.length, 1);
  assert.equal(repair.educationEntries[0].degree, 'B.Tech Computer Science');
  assert.equal(repair.experienceEntries.length, 1);
  assert.equal(repair.projectEntries.length, 1);
  assert.equal(repair.languageEntries.length, 1);
  assert.equal(repair.skills, undefined);
});
