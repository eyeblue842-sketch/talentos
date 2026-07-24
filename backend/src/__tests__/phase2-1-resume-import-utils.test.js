import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import PDFDocument from 'pdfkit';

let env;
let validateUploadedResumeFile;
let expandResumeArchive;
let extractResumeText;
let parseResumeText;

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
  ({ validateUploadedResumeFile, expandResumeArchive, extractResumeText } = await import('../services/resumeImportUtils.js'));
  ({ parseResumeText } = await import('../services/ai/resume-parser.js'));
});

beforeEach(() => {
  env.resumeMaxFileSizeMb = 10;
  env.resumeImportMaxFiles = 100;
  env.resumeImportMaxZipSizeMb = 100;
  env.resumeImportMaxUncompressedMb = 500;
  env.resumeImportMaxTextChars = 120000;
  env.aiResumeParsingEnabled = false;
  env.aiProvider = 'disabled';
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

test('resume text extraction handles text PDFs, image-only PDFs, DOCX files, and legacy DOC review routing', async () => {
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
  assert.equal(doc.errorCode, 'DOC_MANUAL_REVIEW_REQUIRED');
  assert.equal(doc.requiresManualReview, true);
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
