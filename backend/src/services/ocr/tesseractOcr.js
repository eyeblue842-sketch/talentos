import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import yauzl from 'yauzl';

const execFileAsync = promisify(execFile);

// Per-invocation ceiling so a pathological scan can't hang a worker forever.
const OCR_STEP_TIMEOUT_MS = Number(process.env.RESUME_OCR_TIMEOUT_MS || 120000);
const OCR_LANGUAGE = process.env.RESUME_OCR_LANGUAGE || 'eng';
const OCR_MAX_PAGES = Number(process.env.RESUME_OCR_MAX_PAGES || 15);

export function isResumeOcrEnabled() {
  return process.env.RESUME_OCR_ENABLED !== 'false';
}

async function runTesseract(imagePath) {
  const { stdout } = await execFileAsync(
    'tesseract',
    [imagePath, 'stdout', '-l', OCR_LANGUAGE, '--psm', '3'],
    { timeout: OCR_STEP_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 },
  );
  return stdout || '';
}

// Render a scanned/image PDF to page PNGs (poppler pdftoppm) and OCR each page.
export async function ocrPdfBuffer(fileBuffer) {
  const dir = await mkdtemp(path.join(tmpdir(), 'careeriz-ocr-'));
  try {
    const pdfPath = path.join(dir, 'input.pdf');
    await writeFile(pdfPath, fileBuffer);
    await execFileAsync(
      'pdftoppm',
      ['-png', '-r', '200', '-l', String(OCR_MAX_PAGES), pdfPath, path.join(dir, 'page')],
      { timeout: OCR_STEP_TIMEOUT_MS, maxBuffer: 128 * 1024 * 1024 },
    );
    const pages = (await readdir(dir))
      .filter((name) => name.startsWith('page') && name.endsWith('.png'))
      .sort();
    let text = '';
    for (const page of pages) {
      // eslint-disable-next-line no-await-in-loop
      text += `${await runTesseract(path.join(dir, page))}\n`;
    }
    return text.trim();
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function extractDocxMediaToDir(fileBuffer, dir) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(fileBuffer, { lazyEntries: true }, (openError, zipfile) => {
      if (openError) { reject(openError); return; }
      const written = [];
      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        const isMediaImage = /^word\/media\/.+\.(png|jpe?g|bmp|tiff?)$/i.test(entry.fileName);
        if (!isMediaImage) { zipfile.readEntry(); return; }
        zipfile.openReadStream(entry, (streamError, readStream) => {
          if (streamError) { reject(streamError); return; }
          const outName = path.join(dir, path.basename(entry.fileName));
          const out = createWriteStream(outName);
          readStream.pipe(out);
          out.on('finish', () => { written.push(outName); zipfile.readEntry(); });
          out.on('error', reject);
        });
      });
      zipfile.on('end', () => resolve(written));
      zipfile.on('error', reject);
    });
  });
}

// A DOCX whose content is scanned images stores them under word/media/. Extract and OCR them.
export async function ocrDocxBuffer(fileBuffer) {
  const dir = await mkdtemp(path.join(tmpdir(), 'careeriz-ocr-'));
  try {
    const images = await extractDocxMediaToDir(fileBuffer, dir);
    let text = '';
    for (const image of images) {
      // eslint-disable-next-line no-await-in-loop
      text += `${await runTesseract(image)}\n`;
    }
    return text.trim();
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
