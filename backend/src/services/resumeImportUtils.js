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

function buildError(code, message, statusCode = 422) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
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
    } catch {}

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
        const [info, result] = await Promise.all([
          withTimeout(
            parser.getInfo({ parsePageInfo: true }),
            env.aiRequestTimeoutMs,
            'PDF_INFO_TIMEOUT',
            'PDF metadata extraction timed out.'
          ),
          withTimeout(
            parser.getText(),
            env.aiRequestTimeoutMs,
            'PDF_TEXT_TIMEOUT',
            'PDF text extraction timed out.'
          ),
        ]);
        const text = String(result.text || '').replace(/\u0000/g, '').trim();
        const totalPages = Number(info?.total || 0);
        if (!text) {
          return { text: '', errorCode: 'PDF_IMAGE_ONLY', requiresManualReview: true, totalPages };
        }
        return {
          text: text.slice(0, env.resumeImportMaxTextChars),
          errorCode: null,
          requiresManualReview: false,
          totalPages,
        };
      } catch (error) {
        const fallbackText = extractPdfTextFallback(fileBuffer);
        if (!fallbackText) {
          if (error?.code === 'PDF_INFO_TIMEOUT' || error?.code === 'PDF_TEXT_TIMEOUT') {
            throw error;
          }
          return { text: '', errorCode: 'PDF_IMAGE_ONLY', requiresManualReview: true, totalPages: 0 };
        }
        return {
          text: fallbackText.slice(0, env.resumeImportMaxTextChars),
          errorCode: null,
          requiresManualReview: false,
          totalPages: 0,
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
    const text = String(result.value || '').trim();
    if (!text) {
      return { text: '', errorCode: 'DOCX_EMPTY_TEXT', requiresManualReview: true };
    }
    return {
      text: text.slice(0, env.resumeImportMaxTextChars),
      errorCode: null,
      requiresManualReview: false,
    };
  }

  if (extension === '.doc') {
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

export function buildDeterministicResumeParse(text, originalFilename) {
  const fullName = firstNonEmptyLine(text)?.slice(0, 160) || path.basename(originalFilename, path.extname(originalFilename));
  const email = matchEmail(text);
  const phoneNumber = matchPhone(text);
  const linkedInUrl = matchLinkedIn(text);

  return {
    candidate: {
      fullName: { value: fullName || null, confidence: fullName ? 0.55 : 0 },
      email: { value: email, confidence: email ? 0.95 : 0 },
      phoneNumber: { value: phoneNumber, confidence: phoneNumber ? 0.8 : 0 },
      linkedInUrl: { value: linkedInUrl, confidence: linkedInUrl ? 0.92 : 0 },
    },
    metadata: {
      parser: 'careeriz-deterministic-resume-import',
      generatedAt: new Date().toISOString(),
    },
  };
}

export function hasMinimumIdentity(parsedData) {
  const fullName = parsedData?.candidate?.fullName?.value;
  const email = parsedData?.candidate?.email?.value;
  const phone = parsedData?.candidate?.phoneNumber?.value;
  const linkedIn = parsedData?.candidate?.linkedInUrl?.value;
  return Boolean(fullName && (email || phone || linkedIn));
}
