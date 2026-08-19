import path from 'node:path';
import zlib from 'node:zlib';
import yauzl from 'yauzl';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { fileTypeFromBuffer } from 'file-type';
import { env } from '../config/env.js';
import { sanitizeStorageFilename } from '../config/storage.js';

const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.zip']);
const RESUME_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);
const SUPPORTED_MIME_TYPES = new Map([
  ['.pdf', new Set(['application/pdf'])],
  ['.doc', new Set(['application/msword', 'application/octet-stream'])],
  ['.docx', new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'])],
  ['.zip', new Set(['application/zip', 'application/x-zip-compressed', 'multipart/x-zip'])],
]);
const UNSAFE_TEXT_CONTROL_CHARS = new RegExp(String.raw`[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]`, 'g');
const LEGACY_DOC_PRINTABLE_RUNS = new RegExp(String.raw`[A-Za-z0-9][^\u0000-\u0008\u000B\u000C\u000E-\u001F]{3,}`, 'g');
const MOJIBAKE_PATTERN = /(Ã[\w]|Â[\w]|â€|â€“|â€”|â€œ|â€|â€¢|�)/g;
const CERTIFICATION_STRONG_PATTERN = /\b(certified|certification|certificate|credential|license|licensed|accredited|scrum master|pmp|anaplan certified|aws certified|microsoft certified|google professional)\b/i;
const CERTIFICATION_WEAK_REJECT_PATTERN = /\b(work experience|experience|project|responsibilities|responsibility|environment|technology|technologies|tools|skills|summary|profile|education|declaration|personal|father|nationality|passport|marital|task performed|environment setup|company|organization|organisation|client|domain)\b/i;
const FIELD_MAX_LENGTHS = {
  fullName: 80,
  headline: 160,
  currentTitle: 120,
  currentEmployer: 120,
  currentDesignation: 120,
  location: 120,
  currentCity: 80,
  currentState: 80,
  currentCountry: 80,
  summary: 2000,
  portfolioUrl: 300,
  linkedInUrl: 300,
  githubUrl: 300,
};

function buildError(code, message, statusCode = 422) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function sanitizeResumeString(value) {
  return String(value || '')
    .replace(UNSAFE_TEXT_CONTROL_CHARS, '')
    .replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n');
}

export function sanitizeResumeData(value) {
  if (typeof value === 'string') {
    return sanitizeResumeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeResumeData(item));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeResumeData(item)])
    );
  }

  return value;
}

function ratio(part, whole) {
  if (!whole) return 0;
  return part / whole;
}

function countMatches(pattern, value) {
  const matches = String(value || '').match(pattern);
  return matches ? matches.length : 0;
}

function hasCorruptedEncodingSignals(value) {
  const text = String(value || '');
  if (!text) return false;

  if (countMatches(MOJIBAKE_PATTERN, text) > 0 || /[\uFFFD]/u.test(text)) {
    return true;
  }

  const suspiciousLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 24)
    .filter((line) => {
      const punctuationCount = countMatches(/[^\p{L}\p{N}\s]/gu, line);
      return ratio(punctuationCount, line.length) > 0.38;
    });

  return suspiciousLines.length >= 2;
}

function hasMeaningfulPdfText(value) {
  const compact = sanitizeResumeString(value).replace(/\s+/g, ' ').trim();
  if (!compact) return false;

  const letters = countMatches(/\p{L}/gu, compact);
  if (letters < 12) return false;

  return !/^[-\d\sof]+$/i.test(compact);
}

export function assessResumeTextQuality(text) {
  const sanitizedText = sanitizeResumeString(text).replace(/\r\n/g, '\n').trim();
  if (!sanitizedText) {
    return {
      usable: false,
      score: 0,
      reasons: ['EMPTY_TEXT'],
      text: '',
    };
  }

  const compact = sanitizedText.replace(/\s+/g, ' ');
  const letters = countMatches(/\p{L}/gu, compact);
  const digits = countMatches(/\d/g, compact);
  const punctuation = countMatches(/[^\p{L}\p{N}\s]/gu, compact);
  const mojibake = countMatches(MOJIBAKE_PATTERN, compact);
  const tokens = compact.split(/\s+/).filter(Boolean);
  const weirdTokens = tokens.filter((token) => token.length >= 8
    && /[0-9]/.test(token)
    && /[^A-Za-z0-9]/.test(token)
    && !/@/.test(token)
    && !/^https?:\/\//i.test(token));
  const longLines = sanitizedText
    .split('\n')
    .filter((line) => line.trim().length > 220)
    .length;

  let score = 1;
  const reasons = [];

  if (letters < 24) {
    score -= 0.35;
    reasons.push('TOO_FEW_LETTERS');
  }
  if (ratio(punctuation, compact.length) > 0.18) {
    score -= 0.3;
    reasons.push('HIGH_PUNCTUATION_DENSITY');
  }
  if (ratio(digits, compact.length) > 0.22) {
    score -= 0.15;
    reasons.push('HIGH_DIGIT_DENSITY');
  }
  if (mojibake >= 2 || hasCorruptedEncodingSignals(compact)) {
    score -= 0.3;
    reasons.push('BROKEN_CHARACTER_ENCODING');
  }
  if (weirdTokens.length >= 2) {
    score -= 0.3;
    reasons.push('GIBBERISH_TOKEN_SEQUENCES');
  }
  if (longLines >= 2) {
    score -= 0.15;
    reasons.push('ABNORMAL_LINE_LENGTHS');
  }
  if (!matchEmail(compact) && !matchPhone(compact) && !matchLinkedIn(compact)) {
    score -= 0.1;
    reasons.push('MISSING_IDENTITY_SIGNALS');
  }

  const hasIdentitySignals = Boolean(matchEmail(compact) || matchPhone(compact) || matchLinkedIn(compact));
  const usable = (score >= 0.55 || (score >= 0.45 && hasIdentitySignals))
    && !reasons.includes('BROKEN_CHARACTER_ENCODING')
    && !reasons.includes('GIBBERISH_TOKEN_SEQUENCES');
  return {
    usable,
    score: Number(Math.max(0, Math.min(1, score)).toFixed(3)),
    reasons,
    text: sanitizedText,
  };
}

async function withTimeout(promise, timeoutMs, code, message) {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(buildError(code, message, 408)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function decodePdfLiteral(value) {
  return value
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\');
}

function decodePdfHex(value) {
  try {
    return Buffer.from(value.replace(/\s+/g, ''), 'hex').toString('utf8');
  } catch {
    return '';
  }
}

function extractPdfTextFallback(fileBuffer) {
  const binary = fileBuffer.toString('latin1');
  const streamRegex = /stream\r?\n/g;
  const snippets = [];
  let match = streamRegex.exec(binary);

  while (match) {
    const start = match.index + match[0].length;
    const end = binary.indexOf('endstream', start);
    if (end === -1) break;

    const rawChunk = fileBuffer.subarray(start, end);
    const candidates = [rawChunk];
    try {
      candidates.unshift(zlib.inflateSync(rawChunk));
    } catch {
      // Best-effort fallback: continue with the raw chunk when inflate fails.
    }

    for (const candidate of candidates) {
      const text = candidate.toString('latin1');
      const literalMatches = text.match(/\((?:\\.|[^()\\])+\)\s*Tj/g) || [];
      for (const literal of literalMatches) {
        snippets.push(decodePdfLiteral(literal.replace(/\)\s*Tj$/, '').slice(1)));
      }

      const arrayMatches = text.match(/\[(.*?)\]\s*TJ/gs) || [];
      for (const arrayText of arrayMatches) {
        let combined = '';
        const literals = arrayText.match(/\((?:\\.|[^()\\])+\)/g) || [];
        for (const literal of literals) {
          combined += decodePdfLiteral(literal.slice(1, -1));
        }
        const hexParts = arrayText.match(/<([0-9A-Fa-f\s]+)>/g) || [];
        for (const hexPart of hexParts) {
          combined += decodePdfHex(hexPart.slice(1, -1));
        }
        if (combined) {
          snippets.push(combined);
        }
      }
    }

    match = streamRegex.exec(binary);
  }

  return snippets.join(' ').replace(/\s+/g, ' ').trim();
}

function extractLegacyDocTextFallback(fileBuffer) {
  const collectPrintableRuns = (text) => {
    const matches = text.match(LEGACY_DOC_PRINTABLE_RUNS) || [];
    return matches
      .map((match) => match.replace(/\s+/g, ' ').trim())
      .filter((match) => match.length >= 4);
  };

  const candidates = [
    fileBuffer.toString('utf16le').split('\u0000').join(' '),
    fileBuffer.toString('latin1'),
  ];

  const lines = [];
  for (const candidate of candidates) {
    for (const line of collectPrintableRuns(candidate)) {
      if (!lines.includes(line)) {
        lines.push(line);
      }
    }
  }

  return lines.join('\n').trim();
}

export function getExtension(filename) {
  return path.extname(String(filename || '')).toLowerCase();
}

export function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email || null;
}

export function normalizePhone(value) {
  const digits = String(value || '').replace(/[^\d+]/g, '');
  return digits || null;
}

export function normalizeLinkedInUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value).trim());
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (!host.includes('linkedin.com')) return url.toString().replace(/\/$/, '');
    url.protocol = 'https:';
    url.hostname = host;
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return String(value || '').trim().toLowerCase() || null;
  }
}

export async function sniffFileType(fileBuffer, fallbackExtension) {
  const detected = await fileTypeFromBuffer(fileBuffer).catch(() => null);
  if (detected?.ext) {
    return `.${detected.ext.toLowerCase()}`;
  }
  return fallbackExtension;
}

export async function validateUploadedResumeFile(file, { allowZip = true } = {}) {
  if (!file?.buffer?.length) {
    throw buildError('EMPTY_FILE', 'Uploaded file is empty.');
  }

  const extension = getExtension(file.originalname);
  if (!SUPPORTED_EXTENSIONS.has(extension) || (!allowZip && extension === '.zip')) {
    throw buildError('UNSUPPORTED_FILE_TYPE', 'Unsupported file type. Supported files: PDF, DOC, DOCX, ZIP.');
  }

  const detectedExtension = await sniffFileType(file.buffer, extension);
  if (detectedExtension !== extension && !(extension === '.docx' && detectedExtension === '.zip')) {
    throw buildError('FILE_SIGNATURE_MISMATCH', 'File contents do not match the file extension.');
  }

  const maxBytes = extension === '.zip'
    ? env.resumeImportMaxZipSizeMb * 1024 * 1024
    : env.resumeMaxFileSizeMb * 1024 * 1024;
  if ((file.size || file.buffer.length) > maxBytes) {
    throw buildError('FILE_TOO_LARGE', `File exceeds the ${Math.round(maxBytes / (1024 * 1024))}MB limit.`);
  }

  const allowedMimeTypes = SUPPORTED_MIME_TYPES.get(extension);
  if (allowedMimeTypes && file.mimetype && !allowedMimeTypes.has(file.mimetype)) {
    if (!(extension === '.doc' && file.mimetype === 'application/x-ole-storage')) {
      throw buildError('UNSUPPORTED_MIME_TYPE', 'Unsupported file MIME type.');
    }
  }

  return {
    extension,
    detectedExtension,
    sanitizedFilename: sanitizeStorageFilename(file.originalname),
  };
}

function yauzlFromBuffer(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, decodeStrings: true }, (error, zipFile) => {
      if (error) reject(error);
      else resolve(zipFile);
    });
  });
}

function readZipEntry(zipFile, entry) {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  });
}

export async function expandResumeArchive(file) {
  const zipFile = await yauzlFromBuffer(file.buffer).catch(() => {
    throw buildError('INVALID_ZIP', 'ZIP file could not be opened.');
  });

  const entries = [];
  let totalUncompressedBytes = 0;

  return new Promise((resolve, reject) => {
    zipFile.on('entry', async (entry) => {
      try {
        const entryName = entry.fileName || '';
        if (/\/$/.test(entryName)) {
          zipFile.readEntry();
          return;
        }

        if (entry.generalPurposeBitFlag & 0x1) {
          throw buildError('ENCRYPTED_ZIP', 'Encrypted ZIP files are not supported.');
        }

        if (entryName.includes('..') || path.isAbsolute(entryName)) {
          throw buildError('ZIP_PATH_TRAVERSAL', 'ZIP file contains an unsafe path.');
        }

        const extension = getExtension(entryName);
        if (extension === '.zip') {
          throw buildError('NESTED_ZIP', 'Nested ZIP files are not supported.');
        }
        if (!RESUME_EXTENSIONS.has(extension)) {
          throw buildError('ZIP_UNSUPPORTED_ENTRY', 'ZIP file contains an unsupported file.');
        }

        totalUncompressedBytes += entry.uncompressedSize || 0;
        if (totalUncompressedBytes > env.resumeImportMaxUncompressedMb * 1024 * 1024) {
          throw buildError('ZIP_TOO_LARGE', 'ZIP contents exceed the maximum uncompressed size.');
        }

        const buffer = await readZipEntry(zipFile, entry);
        const validated = await validateUploadedResumeFile({
          originalname: path.basename(entryName),
          mimetype: file.mimetype,
          size: buffer.length,
          buffer,
        }, { allowZip: false });

        entries.push({
          originalname: path.basename(entryName),
          mimetype: file.mimetype,
          size: buffer.length,
          buffer,
          extension: validated.extension,
          sanitizedFilename: validated.sanitizedFilename,
        });
        zipFile.readEntry();
      } catch (error) {
        zipFile.close();
        reject(error);
      }
    });

    zipFile.once('end', () => {
      if (entries.length > env.resumeImportMaxFiles) {
        reject(buildError('ZIP_TOO_MANY_FILES', `ZIP file exceeds the ${env.resumeImportMaxFiles} file limit.`));
        return;
      }
      resolve(entries);
    });

    zipFile.once('error', (error) => reject(buildError('INVALID_ZIP', error.message)));
    zipFile.readEntry();
  });
}

export async function extractResumeText({ extension, fileBuffer }) {
  if (extension === '.pdf') {
    const pdfData = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
    const parser = new PDFParse({ data: pdfData });
    try {
      try {
        const result = await withTimeout(
          parser.getText(),
          env.aiRequestTimeoutMs,
          'PDF_TEXT_TIMEOUT',
          'PDF text extraction timed out.'
        );
        const infoResult = await Promise.allSettled([
          withTimeout(
            parser.getInfo({ parsePageInfo: true }),
            env.aiRequestTimeoutMs,
            'PDF_INFO_TIMEOUT',
            'PDF metadata extraction timed out.'
          ),
        ]);
        const info = infoResult[0]?.status === 'fulfilled' ? infoResult[0].value : null;
        const primaryText = sanitizeResumeString(result.text || '').trim();
        const primaryQuality = assessResumeTextQuality(primaryText);
        const fallbackText = sanitizeResumeString(extractPdfTextFallback(fileBuffer));
        const fallbackQuality = assessResumeTextQuality(fallbackText);
        const totalPages = Number(info?.total || 0);
        if (!hasMeaningfulPdfText(primaryText) && !hasMeaningfulPdfText(fallbackText)) {
          return { text: '', errorCode: 'PDF_IMAGE_ONLY', requiresManualReview: true, totalPages };
        }

        const chosen = [primaryQuality, fallbackQuality]
          .filter((candidate) => candidate.text)
          .sort((left, right) => right.score - left.score)[0] || primaryQuality;

        if (!chosen.usable) {
          if (!hasMeaningfulPdfText(primaryText) && !hasMeaningfulPdfText(fallbackText)) {
            return { text: '', errorCode: 'PDF_IMAGE_ONLY', requiresManualReview: true, totalPages };
          }
          return {
            text: '',
            errorCode: 'PDF_TEXT_LOW_QUALITY',
            requiresManualReview: true,
            totalPages,
            strategy: 'quality_gate_rejected',
            quality: {
              score: chosen.score,
              reasons: chosen.reasons,
            },
          };
        }

        return {
          text: chosen.text.slice(0, env.resumeImportMaxTextChars),
          errorCode: null,
          requiresManualReview: false,
          totalPages,
          strategy: chosen === fallbackQuality ? 'pdf_literal_fallback' : 'pdf_parse',
          quality: {
            score: chosen.score,
            reasons: chosen.reasons,
          },
        };
      } catch (error) {
        const fallbackText = sanitizeResumeString(extractPdfTextFallback(fileBuffer));
        const fallbackQuality = assessResumeTextQuality(fallbackText);
        if (!hasMeaningfulPdfText(fallbackText)) {
          if (error?.code === 'PDF_INFO_TIMEOUT' || error?.code === 'PDF_TEXT_TIMEOUT') {
            throw error;
          }
          return { text: '', errorCode: 'PDF_IMAGE_ONLY', requiresManualReview: true, totalPages: 0 };
        }
        if (!fallbackQuality.usable) {
          return {
            text: '',
            errorCode: 'PDF_TEXT_LOW_QUALITY',
            requiresManualReview: true,
            totalPages: 0,
            strategy: 'quality_gate_rejected',
            quality: {
              score: fallbackQuality.score,
              reasons: fallbackQuality.reasons,
            },
          };
        }
        return {
          text: fallbackQuality.text.slice(0, env.resumeImportMaxTextChars),
          errorCode: null,
          requiresManualReview: false,
          totalPages: 0,
          strategy: 'pdf_literal_fallback',
          quality: {
            score: fallbackQuality.score,
            reasons: fallbackQuality.reasons,
          },
        };
      }
    } finally {
      await parser.destroy?.().catch(() => {});
    }
  }

  if (extension === '.docx') {
    const result = await withTimeout(
      mammoth.extractRawText({ buffer: fileBuffer }),
      env.aiRequestTimeoutMs,
      'DOCX_TEXT_TIMEOUT',
      'DOCX text extraction timed out.'
    );
    const text = sanitizeResumeString(result.value || '').trim();
    const quality = assessResumeTextQuality(text);
    if (!text) {
      return { text: '', errorCode: 'DOCX_EMPTY_TEXT', requiresManualReview: true };
    }
    if (!quality.usable) {
      return {
        text: '',
        errorCode: 'DOCX_TEXT_LOW_QUALITY',
        requiresManualReview: true,
        quality: {
          score: quality.score,
          reasons: quality.reasons,
        },
      };
    }
    return {
      text: quality.text.slice(0, env.resumeImportMaxTextChars),
      errorCode: null,
      requiresManualReview: false,
      quality: {
        score: quality.score,
        reasons: quality.reasons,
      },
    };
  }

  if (extension === '.doc') {
    const text = sanitizeResumeString(extractLegacyDocTextFallback(fileBuffer));
    const quality = assessResumeTextQuality(text);
    if (text) {
      if (!quality.usable) {
        return {
          text: '',
          errorCode: 'DOC_TEXT_LOW_QUALITY',
          requiresManualReview: true,
          strategy: 'legacy_doc_quality_gate_rejected',
          quality: {
            score: quality.score,
            reasons: quality.reasons,
          },
        };
      }
      return {
        text: quality.text.slice(0, env.resumeImportMaxTextChars),
        errorCode: null,
        requiresManualReview: false,
        strategy: 'legacy_doc_fallback',
        quality: {
          score: quality.score,
          reasons: quality.reasons,
        },
      };
    }
    return {
      text: '',
      errorCode: 'DOC_MANUAL_REVIEW_REQUIRED',
      requiresManualReview: true,
      strategy: 'manual_review_required',
    };
  }

  return { text: '', errorCode: 'UNSUPPORTED_FILE_TYPE', requiresManualReview: true };
}

function matchEmail(text) {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] || null;
}

function matchPhone(text) {
  const match = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
  return match?.[0] || null;
}

function matchLinkedIn(text) {
  const match = text.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i);
  return match?.[0] || null;
}

function firstNonEmptyLine(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || null;
}

function inferHeaderSegment(text) {
  const source = String(text || '').split('\u0000').join(' ').replace(/\s+/g, ' ').trim();
  if (!source) return '';
  const headingMatch = source.match(/\b(summary|profile|professional summary|experience|work experience|education|skills|technical skills|projects|certifications?|languages?)\b/i);
  if (!headingMatch) return source;
  return source.slice(0, headingMatch.index).trim();
}

function inferFullName(text, originalFilename) {
  const firstLine = firstNonEmptyLine(text);
  if (firstLine && firstLine.length <= 80 && !/@/.test(firstLine) && !/^https?:\/\//i.test(firstLine)) {
    return firstLine.slice(0, 160);
  }

  const header = inferHeaderSegment(text);
  const email = matchEmail(text);
  if (email) {
    const localPartTokens = email
      .split('@')[0]
      .split(/[._-]+/)
      .map((token) => token.trim())
      .filter(Boolean);
    if (localPartTokens.length >= 2) {
      const expectedName = localPartTokens
        .slice(0, 3)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
        .join(' ');
      if (header.toLowerCase().startsWith(expectedName.toLowerCase())) {
        return expectedName.slice(0, 160);
      }
    }
  }

  const match = header.match(/^\s*([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})\b/);
  if (match?.[1]) return match[1].slice(0, 160);

  return path.basename(originalFilename, path.extname(originalFilename));
}

function normalizeResumeLines(text) {
  return prepareStructuredResumeText(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim());
}

const SECTION_ALIASES = {
  summary: ['summary', 'profile', 'professional summary', 'profile summary', 'career summary', 'about', 'objective', 'career objective'],
  experience: ['experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history', 'career history'],
  education: ['education', 'academic background', 'academic qualifications', 'training', 'training & education details', 'education details'],
  certifications: ['certifications', 'certification', 'certificates', 'licenses', 'credentials'],
  projects: ['projects', 'project experience', 'key projects', 'project details'],
  skills: ['skills', 'technical skills', 'core skills', 'expertise', 'technical expertise', 'competencies'],
  languages: ['languages', 'language proficiency'],
  links: ['links', 'portfolio', 'profiles'],
  personal: ['personal details', 'personal information', 'personal data', 'declaration'],
};

const SECTION_ORDER = ['summary', 'experience', 'education', 'certifications', 'projects', 'skills', 'languages', 'links', 'personal'];

function headingVariants(heading) {
  return [...new Set([
    heading,
    heading.toUpperCase(),
    heading.replace(/\b\w/g, (character) => character.toUpperCase()),
  ])];
}

function prepareStructuredResumeText(text) {
  let normalized = String(text || '').split('\u0000').join(' ');
  const headings = [...new Set(Object.values(SECTION_ALIASES).flat())].sort((left, right) => right.length - left.length);

  for (const heading of headings) {
    for (const variant of headingVariants(heading)) {
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      normalized = normalized.replace(new RegExp(`\\s+(${escaped})\\s+(?=[A-Z])`, 'g'), `\n$1\n`);
    }
  }

  normalized = normalized
    .replace(/\s+(Project:|Domain:|Responsibilities:|Technologies:|Technology:|Environment:|Role:|Company:|Client:|Duration:|Description:|CGPA:|GPA:)\s*/g, '\n$1 ')
    .replace(/([A-Za-z)])\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\s*[-â€“]\s*(?:Present|Current|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4}))/g, '$1\n$2')
    .replace(/(Certified Model Builder)\s+(AWS Certified|Microsoft Certified|Google Professional|Scrum Master|PMP)/g, '$1\n$2');

  return normalized;
}

function normalizeHeadingText(line) {
  return String(line || '')
    .trim()
    .toLowerCase()
    .replace(/[:|-]+$/g, '')
    .replace(/\s+/g, ' ');
}

function toHeadingKey(line) {
  const normalized = normalizeHeadingText(line);
  for (const [key, aliases] of Object.entries(SECTION_ALIASES)) {
    if (aliases.includes(normalized)) {
      return key;
    }
  }
  return null;
}

function isHeadingLine(line) {
  return Boolean(toHeadingKey(line));
}

function sectionHeadingPattern(heading) {
  return heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}

function extractSectionBlocks(text) {
  const normalizedText = prepareStructuredResumeText(text).replace(/\r\n/g, '\n');
  const matches = [];

  for (const [key, aliases] of Object.entries(SECTION_ALIASES)) {
    for (const alias of aliases) {
      const pattern = new RegExp(`(?:^|\\n)\\s*${sectionHeadingPattern(alias)}\\s*:?\\s*(?=\\n|$)`, 'gi');
      let match = pattern.exec(normalizedText);
      while (match) {
        matches.push({
          key,
          index: match.index,
          length: match[0].length,
        });
        match = pattern.exec(normalizedText);
      }
    }
  }

  matches.sort((left, right) => left.index - right.index);
  const sections = {};
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const body = normalizedText.slice(current.index + current.length, next ? next.index : normalizedText.length).trim();
    if (!body) continue;
    sections[current.key] = sections[current.key] || [];
    sections[current.key].push(body);
  }

  return sections;
}

function splitSections(text) {
  const sections = {
    header: [],
    summary: [],
    experience: [],
    education: [],
    certifications: [],
    projects: [],
    skills: [],
    languages: [],
    links: [],
    personal: [],
  };

  const blockSections = extractSectionBlocks(text);
  const lineSections = {};
  let current = 'header';
  for (const line of normalizeResumeLines(text)) {
    if (isHeadingLine(line)) {
      current = toHeadingKey(line) || 'header';
      continue;
    }
    lineSections[current] = lineSections[current] || [];
    lineSections[current].push(line);
  }

  for (const [key, lines] of Object.entries(lineSections)) {
    if (lines?.length) {
      sections[key] = lines;
    }
  }

  for (const key of SECTION_ORDER) {
    if (sections[key]?.length) continue;
    const blocks = blockSections[key];
    if (!blocks?.length) continue;
    sections[key] = blocks.flatMap((block) => normalizeResumeLines(block));
  }

  return sections;
}

function extractUrls(text) {
  return [...new Set((String(text || '').match(/https?:\/\/[^\s)]+/gi) || []).map((item) => item.trim()))];
}

function normalizeListItems(lines = []) {
  return [...new Set(lines
    .flatMap((line) => String(line || '').split(/[|,•·]/))
    .map((item) => item.replace(/^[-\u2022*]+\s*/, '').trim())
    .filter(Boolean))];
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

const REJECTED_SCALAR_VALUES = new Set([
  'e-mail',
  'e-mail:',
  'email',
  'email:',
  'phone',
  'phone:',
  'mobile',
  'mobile:',
  'address',
  'address:',
  'personal data',
  'personal details',
  'career objective',
  'resume',
  'curriculum vitae',
  'declaration',
  'work experience',
  'education details',
  'details',
  'task performed',
  'environment setup',
]);

function sanitizeCandidateScalar(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;
  return REJECTED_SCALAR_VALUES.has(normalized.toLowerCase()) ? null : normalized;
}

function looksLikeLocationValue(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return false;
  if (normalized.length > FIELD_MAX_LENGTHS.location) return false;
  if (/@|https?:\/\//i.test(normalized)) return false;
  if (/\b(summary|experience|education|declaration|responsibilities|task performed|environment setup|project|organization|organisation)\b/i.test(normalized)) return false;
  if (countMatches(/[,.]/g, normalized) > 4) return false;
  if (normalized.split(/\s+/).length > 10) return false;
  return /^(remote|hybrid|onsite|[A-Za-z][A-Za-z.' -]+(?:,\s*[A-Za-z][A-Za-z.' -]+){0,2})$/i.test(normalized);
}

function looksLikeTechnologyValue(value) {
  return /\b(rxjs|react|angular|vue|node\.?js|javascript|typescript|python|java|sql|mysql|postgres(?:ql)?|mongodb|redis|docker|kubernetes|azure|aws|gcp|html|css|scss|bootstrap|highcharts|jira|figma)\b/i.test(normalizeWhitespace(value));
}

function looksLikeGeoSegmentValue(value, { maxWords = 4 } = {}) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return false;
  if (normalized.length > 48) return false;
  if (/@|https?:\/\//i.test(normalized)) return false;
  if (/[|/\\]/.test(normalized)) return false;
  if (/\d/.test(normalized)) return false;
  if (looksLikeTechnologyValue(normalized)) return false;
  if (/\b(summary|experience|education|declaration|responsibilities|task performed|environment setup|project|organization|organisation|developer|engineer|manager|lead|consultant|architect|analyst)\b/i.test(normalized)) return false;
  const words = normalized.split(/\s+/);
  if (words.length > maxWords) return false;
  if (!words.every((word) => /^[A-Z][A-Za-z.'-]*$/.test(word) || /^(of|and|the)$/i.test(word) || /^[A-Z]{2,3}$/.test(word))) return false;
  return /^[A-Za-z][A-Za-z.' -]+$/.test(normalized);
}

function looksLikeCityValue(value) {
  return looksLikeGeoSegmentValue(value, { maxWords: 4 });
}

function looksLikeStateValue(value) {
  return looksLikeGeoSegmentValue(value, { maxWords: 4 });
}

function looksLikeCountryValue(value) {
  const normalized = normalizeWhitespace(value);
  if (!looksLikeGeoSegmentValue(normalized, { maxWords: 4 })) return false;
  if (/^[A-Z]{2,3}$/.test(normalized)) return true;
  return normalized.split(/\s+/).length <= 3;
}

function looksLikeJobTitleValue(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return false;
  if (normalized.length > FIELD_MAX_LENGTHS.currentTitle) return false;
  if (/@|https?:\/\//i.test(normalized)) return false;
  if (/[:,]/.test(normalized) && !/\|/.test(normalized)) return false;
  if (/\b(email|e-mail|phone|mobile|address|declaration|details|task performed|environment setup)\b/i.test(normalized)) return false;
  if (normalized.split(/\s+/).length > 12) return false;
  return /\b(engineer|developer|architect|manager|lead|specialist|analyst|consultant|designer|administrator|coordinator|recruiter|hr|director|intern|officer|model builder)\b/i.test(normalized)
    || /\|/.test(normalized);
}

function looksLikeOrganisationValue(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return false;
  if (normalized.length > FIELD_MAX_LENGTHS.currentEmployer) return false;
  if (/@|https?:\/\//i.test(normalized)) return false;
  if (/\b(summary|responsibilities|declaration|project|environment|task performed|details|work experience|education|skills)\b/i.test(normalized)) return false;
  if (normalized.split(/\s+/).length > 10) return false;
  if (!/^[A-Za-z0-9&.,'() -]+$/.test(normalized)) return false;
  const hasOrganisationSignal = /\b(labs|lab|technologies|technology|solutions|systems|consulting|services|service|bank|corp|corporation|inc|llc|ltd|limited|pvt|private|company|group|software|tech|digital|industries|enterprises|global|partners|studio|works)\b/i.test(normalized);
  if (looksLikeLocationValue(normalized) && !hasOrganisationSignal && (/,/.test(normalized) || normalized.split(/\s+/).length > 1)) return false;
  if (/,/.test(normalized) && !hasOrganisationSignal) return false;
  return true;
}

function looksLikeHeadlineValue(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return false;
  if (normalized.length > FIELD_MAX_LENGTHS.headline) return false;
  if (/@|https?:\/\//i.test(normalized)) return false;
  if (/\b(e-mail|email|phone|mobile|address|declaration|details|work experience|education)\b/i.test(normalized)) return false;
  if (looksLikeOrganisationValue(normalized) && !looksLikeJobTitleValue(normalized)) return false;
  if (looksLikeJobTitleValue(normalized)) return true;
  if (normalized.split(/\s+/).length < 3 || normalized.split(/\s+/).length > 18) return false;
  return /\b(years?|yrs?|experience|frontend|backend|full stack|angular|react|node\.?js|java|python|product|project|program|manager|developer|engineer|consultant|architect|lead)\b/i.test(normalized)
    || /[|/]/.test(normalized);
}

export function sanitizeParsedCandidateField(field, value) {
  const normalized = sanitizeCandidateScalar(value);
  if (!normalized) return null;
  if (hasCorruptedEncodingSignals(normalized)) return null;
  if ((FIELD_MAX_LENGTHS[field] || 160) < normalized.length) return null;

  switch (field) {
    case 'fullName':
      if (/\d|@|https?:\/\//i.test(normalized) || normalized.split(/\s+/).length > 6) return null;
      return normalized;
    case 'headline':
      return looksLikeHeadlineValue(normalized) ? normalized : null;
    case 'currentTitle':
    case 'currentDesignation':
      return looksLikeJobTitleValue(normalized) ? normalized : null;
    case 'currentEmployer':
      return looksLikeOrganisationValue(normalized) ? normalized : null;
    case 'location':
      return looksLikeLocationValue(normalized) ? normalized : null;
    case 'currentCity':
      return looksLikeCityValue(normalized) ? normalized : null;
    case 'currentState':
      return looksLikeStateValue(normalized) ? normalized : null;
    case 'currentCountry':
      return looksLikeCountryValue(normalized) ? normalized : null;
    case 'summary':
      if (normalized.split(/\s+/).length < 5) return null;
      if (/\b(e-mail|email|phone|mobile|declaration|personal details)\b/i.test(normalized)) return null;
      return normalized;
    default:
      return normalized;
  }
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function isIgnoredResumeLine(line) {
  return /^(declaration|personal details|personal information|father'?s name|marital status|date of birth|dob|nationality|passport|religion|gender)\b/i.test(String(line || '').trim());
}

function isDateRangeLine(line) {
  return /((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\b\d{4}\b)\s*[-â€“]\s*((Present|Current)|((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\b\d{4}\b))/i.test(String(line || ''));
}

function stripLeadingLabel(line, labels = []) {
  let result = String(line || '').trim();
  for (const label of labels) {
    result = result.replace(new RegExp(`^${label}\\s*[:|-]?\\s*`, 'i'), '');
  }
  return result.trim();
}

function splitStructuredEntries(lines = [], { isEntryStart } = {}) {
  const filtered = lines.filter((line) => !isIgnoredResumeLine(line));
  const entries = [];
  let current = [];

  for (let index = 0; index < filtered.length; index += 1) {
    const line = filtered[index];
    const previous = filtered[index - 1] || '';

    if (!line) {
      if (current.length) {
        entries.push(current);
        current = [];
      }
      continue;
    }

    if (current.length && isEntryStart?.(line, previous, current)) {
      entries.push(current);
      current = [];
    }

    current.push(line);
  }

  if (current.length) {
    entries.push(current);
  }

  return entries;
}

function inferLocation(lines = []) {
  const candidate = lines.find((line) => (
    line
    && !/@/.test(line)
    && !/^https?:\/\//i.test(line)
    && !/\+?\d[\d\s().-]{7,}\d/.test(line)
    && /,/.test(line)
    && !isHeadingLine(line)
  ));

  if (!candidate) {
    return { location: null, currentCity: null, currentState: null, currentCountry: null };
  }

  const parts = candidate.split(',').map((item) => item.trim()).filter(Boolean);
  return {
    location: candidate,
    currentCity: parts[0] || null,
    currentState: parts[1] || null,
    currentCountry: parts[2] || null,
  };
}

function inferLocationFromText(text) {
  const header = inferHeaderSegment(text)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}.*/i, '')
    .replace(/https?:\/\/\S+.*/i, '')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d).*/i, '')
    .trim();
  const matches = [...header.matchAll(/\b([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,2},\s*[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,2}(?:,\s*[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,2})?)\b/g)];
  const locationMatch = matches.at(-1)?.[1];
  if (!locationMatch) {
    return { location: null, currentCity: null, currentState: null, currentCountry: null };
  }

  const parts = locationMatch.trim().split(',').map((item) => item.trim()).filter(Boolean);
  if (parts[0]) {
    const cleanedCity = parts[0]
      .replace(/\b(senior|staff|lead|principal|frontend|backend|full stack|full-stack|react|node\.js|java|python|developer|engineer|manager|analyst|consultant|designer)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleanedCity) {
      parts[0] = cleanedCity;
    }
  }
  const location = parts.join(', ');
  return {
    location,
    currentCity: parts[0] || null,
    currentState: parts[1] || null,
    currentCountry: parts[2] || null,
  };
}

function inferCurrentTitle(headerLines = [], experienceEntries = []) {
  const headerTitle = headerLines.find((line) => (
    line
    && !/@/.test(line)
    && !/^https?:\/\//i.test(line)
    && !/\+?\d[\d\s().-]{7,}\d/.test(line)
    && !/,/.test(line)
    && line.split(' ').length <= 8
    && !isHeadingLine(line)
  ));

  if (headerTitle) return headerTitle;
  return experienceEntries[0]?.title || null;
}

function inferCurrentTitleFromText(text, fullName, location) {
  let remainder = inferHeaderSegment(text);

  if (fullName) {
    const escapedName = fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    remainder = remainder.replace(new RegExp(`^\\s*${escapedName}\\s*`, 'i'), '').trim();
  }

  remainder = remainder
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}.*/i, '')
    .replace(/https?:\/\/\S+.*/i, '')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d).*/i, '')
    .trim();

  if (location) {
    const locationIndex = remainder.indexOf(location);
    if (locationIndex > 0) {
      remainder = remainder.slice(0, locationIndex).trim();
    }
  }

  if (!remainder) return null;
  const tokens = remainder.split(/\s+/).slice(0, 8);
  return tokens.join(' ').trim() || null;
}

function inferTotalExperience(text, experienceEntries = []) {
  const explicit = String(text || '').match(/(\d{1,2})\+?\s+years?/i);
  if (explicit) return Number(explicit[1]);

  const yearMatches = [...String(text || '').matchAll(/\b(19|20)\d{2}\b/g)].map((match) => Number(match[0]));
  if (yearMatches.length >= 2) {
    const minYear = Math.min(...yearMatches);
    const maxYear = Math.max(...yearMatches);
    if (maxYear >= minYear) {
      return Math.max(0, maxYear - minYear);
    }
  }

  const startYears = experienceEntries
    .map((entry) => Number(String(entry.startDate || '').slice(0, 4)))
    .filter((year) => Number.isFinite(year));
  if (startYears.length) {
    return Math.max(0, new Date().getUTCFullYear() - Math.min(...startYears));
  }

  return 0;
}

function extractDateRange(text) {
  const match = String(text || '').match(/((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*\d{4})\s*[-–]\s*((Present|Current)|((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*\d{4}))/i);
  if (!match) return { startDate: null, endDate: null, currentlyWorking: false };
  return {
    startDate: match[1]?.trim() || null,
    endDate: /present|current/i.test(match[4] || '') ? null : (match[4]?.trim() || null),
    currentlyWorking: /present|current/i.test(match[4] || ''),
  };
}

function splitBySeparators(line) {
  return String(line || '')
    .split(/\s+\|\s+|\s+[–-]\s+(?=[A-Z])/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function looksLikeExperienceHeader(line) {
  const value = String(line || '').trim();
  if (!value || isHeadingLine(value) || isDateRangeLine(value)) return false;
  if (/^(responsibilities|summary|technologies|technology|environment|tools|project|domain|client|location)\s*:/i.test(value)) return false;
  return /\bat\b/i.test(value) || splitBySeparators(value).length >= 2;
}

function parseHeaderTitleCompany(line) {
  const value = String(line || '').trim();
  if (!value) return { title: null, company: null };

  const atMatch = value.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atMatch) {
    return {
      title: sanitizeCandidateScalar(atMatch[1]),
      company: sanitizeCandidateScalar(atMatch[2]),
    };
  }

  const parts = splitBySeparators(value);
  if (parts.length >= 2) {
    return {
      title: sanitizeCandidateScalar(parts[0]),
      company: sanitizeCandidateScalar(parts[1]),
    };
  }

  return { title: sanitizeCandidateScalar(value), company: null };
}

function parseExperienceEntries(lines = []) {
  const entries = splitStructuredEntries(lines, {
    isEntryStart: (line) => looksLikeExperienceHeader(line),
  });

  return uniqueBy(entries.map((chunk) => {
    const headerLine = chunk.find((line) => looksLikeExperienceHeader(line)) || chunk[0] || '';
    const { title, company } = parseHeaderTitleCompany(headerLine);
    const dateLine = chunk.find((line) => isDateRangeLine(line)) || '';
    const dates = extractDateRange(dateLine || chunk.join(' '));
    const locationLine = chunk.find((line) => /,/.test(line) && !/@/.test(line) && !/^https?:\/\//i.test(line) && !isDateRangeLine(line) && !/^(technologies|technology|tools|stack|environment)\s*:/i.test(line)) || null;
    const project = stripLeadingLabel(chunk.find((line) => /^project\s*:/i.test(line)) || '', ['project']);
    const domain = stripLeadingLabel(chunk.find((line) => /^domain\s*:/i.test(line)) || '', ['domain']);
    const technologies = normalizeListItems(
      chunk
        .filter((line) => /^(technologies|technology|tools|stack|environment)\s*:/i.test(line))
        .map((line) => stripLeadingLabel(line, ['technologies', 'technology', 'tools', 'stack', 'environment']))
    );
    const summary = normalizeWhitespace(chunk
      .filter((line) => ![headerLine, dateLine, locationLine].includes(line))
      .filter((line) => !/^(project|domain|technologies|technology|tools|stack|environment)\s*:/i.test(line))
      .map((line) => stripLeadingLabel(line, ['responsibilities', 'summary']))
      .join(' ')) || null;

    return {
      company: company || null,
      employer: company || null,
      designation: title || null,
      title: title || null,
      jobTitle: title || null,
      employmentType: null,
      startDate: dates.startDate,
      endDate: dates.endDate,
      currentlyWorking: dates.currentlyWorking,
      isCurrent: dates.currentlyWorking,
      duration: dateLine ? normalizeWhitespace(dateLine) : null,
      location: locationLine,
      project: project || null,
      domain: domain || null,
      responsibilities: summary ? [summary] : [],
      technologies,
      skills: technologies,
      summary,
      description: summary,
    };
  }).filter((entry) => entry.title || entry.company), (entry) => JSON.stringify([entry.title, entry.company, entry.startDate, entry.endDate]));
}

function parseExperienceEntriesFromText(text) {
  const experienceScoped = String(text || '').match(/experience\s+(.+)/i)?.[1] || String(text || '');
  const match = experienceScoped.match(/([A-Za-z][A-Za-z\s/&.-]{2,}?)\s+at\s+([A-Za-z0-9&.,' -]{2,}?)(?=\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4}|Present|Current))/i)
    || experienceScoped.match(/([A-Za-z][A-Za-z\s/&.-]{2,}?)\s+at\s+([A-Za-z0-9&.,' -]{2,})/i);
  if (!match) return [];

  const dates = extractDateRange(text);
  return [{
    title: match[1].trim(),
    jobTitle: match[1].trim(),
    company: match[2].trim(),
    employer: match[2].trim(),
    location: null,
    startDate: dates.startDate,
    endDate: dates.endDate,
    currentlyWorking: dates.currentlyWorking,
    summary: null,
  }];
}

function parseEducationEntries(lines = []) {
  const entries = splitStructuredEntries(lines, {
    isEntryStart: (line, previous) => Boolean(previous) && /\b(B\.?Tech|M\.?Tech|B\.?E|M\.?E|Bachelor|Master|MBA|BCA|MCA|Diploma|Higher Secondary|Secondary School)\b/i.test(line),
  });

  return uniqueBy(entries.map((chunk) => {
    const joined = chunk.join(' ');
    const scoreMatch = joined.match(/\b(CGPA|GPA|Percentage|Percent|Score)\s*[:|-]?\s*([0-9]+(?:\.[0-9]+)?%?)\b/i);
    const years = [...joined.matchAll(/\b(19|20)\d{2}\b/g)].map((match) => match[0]);
    const degreeLine = chunk.find((line) => /\b(B\.?Tech|M\.?Tech|B\.?E|M\.?E|Bachelor|Master|MBA|BCA|MCA|Diploma|Higher Secondary|Secondary School|Class\s*(X|XII|10|12))\b/i.test(line)) || '';
    const institutionLine = chunk.find((line) => line !== degreeLine && /\b(University|College|Institute|School)\b/i.test(line)) || chunk[1] || null;
    const fieldMatch = degreeLine.match(/\b(in|of)\s+([A-Za-z&/ .-]{2,})$/i);
    const locationLine = chunk.find((line) => /,/.test(line) && !isDateRangeLine(line) && !/@/.test(line)) || null;
    const degree = sanitizeCandidateScalar(degreeLine);
    if (!degree || /^details$/i.test(degree)) {
      return null;
    }

    return {
      degree,
      institution: institutionLine ? sanitizeCandidateScalar(institutionLine) : null,
      specialization: fieldMatch?.[2] ? normalizeWhitespace(fieldMatch[2]) : null,
      fieldOfStudy: fieldMatch?.[2] ? normalizeWhitespace(fieldMatch[2]) : null,
      startYear: years[0] || null,
      endYear: years.length > 1 ? years.at(-1) : null,
      year: years.at(-1) || years[0] || null,
      score: scoreMatch?.[2] || null,
      location: locationLine,
      educationType: /\b(class\s*(x|xii|10|12)|school)\b/i.test(degree) ? 'SCHOOL' : 'COLLEGE',
      summary: normalizeWhitespace(chunk.filter((line) => ![degreeLine, institutionLine, locationLine].includes(line)).join(' ')) || null,
    };
  }).filter(Boolean).filter((entry) => entry.degree || entry.institution), (entry) => JSON.stringify([entry.degree, entry.institution, entry.year]));
}

function parseEducationEntriesFromText(text) {
  const educationScoped = String(text || '').match(/education\s+(.+)/i)?.[1] || '';
  if (!educationScoped) return [];

  const yearMatch = educationScoped.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch?.[0] || null;
  const source = year ? educationScoped.slice(0, yearMatch.index).trim() : educationScoped.trim();
  if (!source) return [];

  const tokens = source.split(/\s+/);
  if (!tokens.length) return [];

  return [{
    degree: tokens.slice(0, Math.min(4, tokens.length)).join(' ') || null,
    institution: tokens.length > 4 ? tokens.slice(4).join(' ') : null,
    year,
    summary: null,
  }];
}

function isCertificationLine(line) {
  const value = normalizeWhitespace(line);
  if (!value || isIgnoredResumeLine(value)) return false;
  if (/^certifications?$/i.test(value)) return false;
  if (CERTIFICATION_WEAK_REJECT_PATTERN.test(value)) return false;
  if (value.split(' ').length > 12) return false;
  if (value.length > 120) return false;
  if (/@|https?:\/\//i.test(value)) return false;
  return CERTIFICATION_STRONG_PATTERN.test(value);
}

function parseCertificationEntries(lines = []) {
  return uniqueBy(normalizeListItems(lines)
    .filter((item) => isCertificationLine(item))
    .map((item) => ({
      name: item,
      issuingOrganisation: null,
      issueDate: null,
      expiryDate: null,
      credentialId: null,
      credentialUrl: null,
    })).slice(0, 8), (entry) => entry.name.toLowerCase());
}

function parseCertificationEntriesFromText(text) {
  return parseCertificationEntries(normalizeResumeLines(text));
}

function parseProjectEntries(lines = []) {
  const entries = splitStructuredEntries(lines, {
    isEntryStart: (line) => !/^(client|company|role|duration|domain|environment|team size|technologies|responsibilities|summary|description)\s*:/i.test(line),
  });

  return uniqueBy(entries.map((chunk) => {
    const nameLine = chunk[0] || null;
    const roleLine = stripLeadingLabel(chunk.find((line) => /^role\s*:/i.test(line)) || '', ['role']);
    const companyLine = stripLeadingLabel(chunk.find((line) => /^(company|client)\s*:/i.test(line)) || '', ['company', 'client']);
    const durationLine = stripLeadingLabel(chunk.find((line) => /^duration\s*:/i.test(line)) || '', ['duration']);
    const domainLine = stripLeadingLabel(chunk.find((line) => /^domain\s*:/i.test(line)) || '', ['domain']);
    const environmentLine = stripLeadingLabel(chunk.find((line) => /^environment\s*:/i.test(line)) || '', ['environment']);
    const teamSizeLine = stripLeadingLabel(chunk.find((line) => /^team size\s*:/i.test(line)) || '', ['team size']);
    const technologies = normalizeListItems(chunk.filter((line) => /^technologies\s*:/i.test(line)).map((line) => stripLeadingLabel(line, ['technologies'])));
    const description = normalizeWhitespace(chunk
      .filter((line) => line !== nameLine)
      .filter((line) => !/^(role|company|client|duration|domain|environment|team size|technologies)\s*:/i.test(line))
      .map((line) => stripLeadingLabel(line, ['responsibilities', 'summary', 'description']))
      .join(' ')) || null;

    return {
      projectName: sanitizeCandidateScalar(nameLine) || null,
      title: sanitizeCandidateScalar(nameLine) || null,
      name: sanitizeCandidateScalar(nameLine) || null,
      role: roleLine || null,
      company: companyLine || null,
      client: companyLine || null,
      startDate: extractDateRange(durationLine).startDate,
      endDate: extractDateRange(durationLine).endDate,
      duration: durationLine || null,
      domain: domainLine || null,
      environment: environmentLine || null,
      teamSize: teamSizeLine || null,
      technologies,
      skills: technologies,
      responsibilities: description ? [description] : [],
      summary: description,
      description,
    };
  }).filter((entry) => entry.projectName || entry.summary), (entry) => JSON.stringify([entry.projectName, entry.company, entry.duration]));
}

function parseLanguageEntries(lines = []) {
  const entries = [];
  const proficiencyPattern = 'Basic|Conversational|Professional Working|Fluent|Native(?:\\s*\\/\\s*Bilingual)?|Beginner|Intermediate|Advanced';

  for (const item of normalizeListItems(lines)) {
    const matches = [...item.matchAll(new RegExp(`([A-Za-z][A-Za-z\\s()/-]+?)\\s*[-:]\\s*(${proficiencyPattern})(?=\\s+[A-Z][A-Za-z\\s()/-]+?\\s*[-:]\\s*(?:${proficiencyPattern})|$)`, 'gi'))];
    if (matches.length) {
      for (const match of matches) {
        entries.push({
          language: normalizeWhitespace(match[1]),
          name: normalizeWhitespace(match[1]),
          proficiency: normalizeWhitespace(match[2]),
          read: null,
          write: null,
          speak: null,
        });
      }
      continue;
    }

    const language = normalizeWhitespace(item);
    entries.push({ language, name: language, proficiency: null, read: null, write: null, speak: null });
  }

  return uniqueBy(entries.filter((entry) => entry.language && !/\b(declaration|passport|nationality)\b/i.test(entry.language)), (entry) => entry.language.toLowerCase());
}

const skillTaxonomy = {
  frameworks: new Set(['React', 'Next.js', 'Angular', 'Vue', 'Spring Boot', 'Django', 'Flask', 'Express', 'Laravel', 'FastAPI']),
  cloudPlatforms: new Set(['AWS', 'Azure', 'GCP', 'Google Cloud']),
  databases: new Set(['MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Oracle', 'SQL Server', 'SQLite', 'DynamoDB']),
  tools: new Set(['Docker', 'Kubernetes', 'Git', 'Jenkins', 'Terraform', 'Figma', 'Postman', 'Tableau', 'Power BI']),
  softSkills: new Set(['Communication', 'Leadership', 'Collaboration', 'Problem Solving', 'Stakeholder Management', 'Teamwork', 'Mentoring']),
  functionalSkills: new Set(['Product Management', 'Project Management', 'Agile', 'Scrum', 'Data Analysis', 'Testing', 'Automation']),
};

export function normalizeSkillToken(token) {
  const clean = String(token || '').trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  const withoutCategoryPrefix = clean
    .replace(/^(languages?\s*&\s*frameworks?|frameworks?|technical skills|tech skills|technical expertise|core skills|skills|tools|technologies|technology|performance\s*&\s*optimization)\s*:\s*/i, '')
    .trim();
  if (!withoutCategoryPrefix) return null;

  const aliases = new Map([
    ['nodejs', 'Node.js'],
    ['node.js', 'Node.js'],
    ['reactjs', 'React'],
    ['react.js', 'React'],
    ['nextjs', 'Next.js'],
    ['next.js', 'Next.js'],
    ['javascript', 'JavaScript'],
    ['typescript', 'TypeScript'],
    ['postgres', 'PostgreSQL'],
    ['postgresql', 'PostgreSQL'],
    ['mongo', 'MongoDB'],
    ['mongodb', 'MongoDB'],
    ['amazon web services', 'AWS'],
    ['google cloud platform', 'GCP'],
    ['angular 11+', 'Angular'],
    ['angular 12+', 'Angular'],
    ['angular 13+', 'Angular'],
    ['angular 14+', 'Angular'],
    ['angular 15+', 'Angular'],
    ['angular 16+', 'Angular'],
    ['high-charts', 'Highcharts'],
  ]);

  const alias = aliases.get(withoutCategoryPrefix.toLowerCase());
  if (alias) return alias;
  return withoutCategoryPrefix;
}

function inferSkills(text, sectionLines = []) {
  const sectionItems = normalizeListItems(sectionLines).map(normalizeSkillToken).filter(Boolean);
  if (sectionItems.length) return [...new Set(sectionItems)];

  const knownSkills = [
    'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'Java', 'Spring Boot', 'Python', 'Django', 'Flask',
    'AWS', 'Azure', 'GCP', 'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'Git',
    'Jenkins', 'Terraform', 'HTML', 'CSS', 'Power BI', 'Tableau', 'Figma', 'Communication', 'Leadership',
  ];

  const lower = String(text || '').toLowerCase();
  return knownSkills.filter((skill) => lower.includes(skill.toLowerCase()));
}

function classifySkills(skills = []) {
  const base = [...new Set(skills.map(normalizeSkillToken).filter(Boolean))];
  const categories = {
    skills: base,
    functionalSkills: [],
    tools: [],
    frameworks: [],
    cloudPlatforms: [],
    databases: [],
    softSkills: [],
  };

  for (const skill of base) {
    for (const [field, set] of Object.entries(skillTaxonomy)) {
      if (set.has(skill)) {
        categories[field].push(skill);
      }
    }
  }

  for (const key of Object.keys(categories)) {
    categories[key] = [...new Set(categories[key])];
  }

  return categories;
}

export function buildDeterministicResumeParse(text, originalFilename) {
  const fullName = inferFullName(text, originalFilename);
  const email = matchEmail(text);
  const phoneNumber = matchPhone(text);
  const linkedInUrl = matchLinkedIn(text);
  const urls = extractUrls(text);
  const sections = splitSections(text);
  const experienceEntries = parseExperienceEntries(sections.experience);
  const fallbackExperienceEntries = experienceEntries.length ? experienceEntries : parseExperienceEntriesFromText(text);
  const educationEntries = parseEducationEntries(sections.education);
  const fallbackEducationEntries = educationEntries.length ? educationEntries : parseEducationEntriesFromText(text);
  const certificationEntries = uniqueBy([
    ...parseCertificationEntries(sections.certifications),
    ...parseCertificationEntriesFromText(text),
  ], (entry) => entry.name.toLowerCase());
  const projectEntries = parseProjectEntries(sections.projects);
  const languageEntries = parseLanguageEntries(sections.languages);
  const headerLocation = inferLocation(sections.header);
  const locationData = headerLocation.location ? headerLocation : inferLocationFromText(text);
  const skills = inferSkills(text, sections.skills);
  const classifiedSkills = classifySkills(skills);
  const currentTitle = inferCurrentTitle(sections.header.slice(1, 6), fallbackExperienceEntries)
    || inferCurrentTitleFromText(text, fullName, locationData.location);
  const summary = sanitizeParsedCandidateField('summary', normalizeListItems(sections.summary).join(' ')) || null;
  const githubUrl = urls.find((url) => /github\.com/i.test(url)) || null;
  const portfolioUrl = urls.find((url) => !/linkedin\.com/i.test(url) && !/github\.com/i.test(url)) || null;
  const totalExperience = inferTotalExperience(text, fallbackExperienceEntries);
  const safeFullName = sanitizeParsedCandidateField('fullName', fullName);
  const safeHeadline = sanitizeParsedCandidateField('headline', currentTitle);
  const safeCurrentTitle = sanitizeParsedCandidateField('currentTitle', currentTitle);
  const safeEmployer = sanitizeParsedCandidateField('currentEmployer', fallbackExperienceEntries[0]?.company);
  const safeDesignation = sanitizeParsedCandidateField('currentDesignation', fallbackExperienceEntries[0]?.title);
  const safeLocation = sanitizeParsedCandidateField('location', locationData.location);

  return sanitizeResumeData({
    candidate: {
      fullName: { value: safeFullName || null, confidence: safeFullName ? 0.55 : 0 },
      email: { value: email, confidence: email ? 0.95 : 0 },
      phoneNumber: { value: phoneNumber, confidence: phoneNumber ? 0.8 : 0 },
      linkedInUrl: { value: linkedInUrl, confidence: linkedInUrl ? 0.92 : 0 },
      githubUrl: { value: githubUrl, confidence: githubUrl ? 0.9 : 0 },
      portfolioUrl: { value: portfolioUrl, confidence: portfolioUrl ? 0.88 : 0 },
      headline: { value: safeHeadline || null, confidence: safeHeadline ? 0.52 : 0 },
      currentTitle: { value: safeCurrentTitle || null, confidence: safeCurrentTitle ? 0.58 : 0 },
      currentEmployer: { value: safeEmployer || null, confidence: safeEmployer ? 0.52 : 0 },
      currentDesignation: { value: safeDesignation || null, confidence: safeDesignation ? 0.5 : 0 },
      location: { value: safeLocation || null, confidence: safeLocation ? 0.55 : 0 },
      currentCity: { value: sanitizeParsedCandidateField('currentCity', locationData.currentCity), confidence: locationData.currentCity ? 0.48 : 0 },
      currentState: { value: sanitizeParsedCandidateField('currentState', locationData.currentState), confidence: locationData.currentState ? 0.46 : 0 },
      currentCountry: { value: sanitizeParsedCandidateField('currentCountry', locationData.currentCountry), confidence: locationData.currentCountry ? 0.42 : 0 },
      totalExperience: { value: totalExperience, confidence: totalExperience ? 0.5 : 0 },
      summary: { value: summary, confidence: summary ? 0.45 : 0 },
      skills: { value: classifiedSkills.skills, confidence: classifiedSkills.skills.length ? 0.6 : 0 },
      functionalSkills: { value: classifiedSkills.functionalSkills, confidence: classifiedSkills.functionalSkills.length ? 0.52 : 0 },
      tools: { value: classifiedSkills.tools, confidence: classifiedSkills.tools.length ? 0.52 : 0 },
      frameworks: { value: classifiedSkills.frameworks, confidence: classifiedSkills.frameworks.length ? 0.52 : 0 },
      cloudPlatforms: { value: classifiedSkills.cloudPlatforms, confidence: classifiedSkills.cloudPlatforms.length ? 0.52 : 0 },
      databases: { value: classifiedSkills.databases, confidence: classifiedSkills.databases.length ? 0.52 : 0 },
      softSkills: { value: classifiedSkills.softSkills, confidence: classifiedSkills.softSkills.length ? 0.48 : 0 },
      experienceEntries: { value: fallbackExperienceEntries, confidence: fallbackExperienceEntries.length ? 0.45 : 0 },
      educationEntries: { value: fallbackEducationEntries, confidence: fallbackEducationEntries.length ? 0.42 : 0 },
      certificationEntries: { value: certificationEntries, confidence: certificationEntries.length ? 0.4 : 0 },
      projectEntries: { value: projectEntries, confidence: projectEntries.length ? 0.4 : 0 },
      languageEntries: { value: languageEntries, confidence: languageEntries.length ? 0.4 : 0 },
      portfolioLinks: { value: [], confidence: 0 },
    },
    metadata: {
      parser: 'careeriz-deterministic-resume-import',
      generatedAt: new Date().toISOString(),
    },
  });
}

export function hasMinimumIdentity(parsedData) {
  const fullName = parsedData?.candidate?.fullName?.value;
  const email = parsedData?.candidate?.email?.value;
  const phone = parsedData?.candidate?.phoneNumber?.value;
  const linkedIn = parsedData?.candidate?.linkedInUrl?.value;
  return Boolean(fullName && (email || phone || linkedIn));
}
