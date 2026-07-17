import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';

const legacyUploadsRoot = path.resolve(process.cwd(), env.localStoragePath);

function decodeOnce(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function classifyLegacyResumeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return { kind: 'empty' };

  if (raw.startsWith('/uploads/')) {
    return { kind: 'legacy-local', relativePath: raw.slice('/uploads/'.length) };
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const backendUrl = new URL(env.backendUrl);
      if (parsed.origin === backendUrl.origin && parsed.pathname.startsWith('/uploads/')) {
        return { kind: 'legacy-local', relativePath: parsed.pathname.slice('/uploads/'.length) };
      }
      return { kind: 'external', url: raw };
    } catch {
      return { kind: 'invalid', url: raw };
    }
  }

  if (raw.startsWith('uploads/')) {
    return { kind: 'legacy-local', relativePath: raw.slice('uploads/'.length) };
  }

  return { kind: 'unknown', value: raw };
}

export function resolveLegacyResumePath(value) {
  const classified = classifyLegacyResumeUrl(value);
  if (classified.kind !== 'legacy-local') {
    const error = new Error('Legacy resume path is not eligible for compatibility access.');
    error.statusCode = 404;
    throw error;
  }

  const decodedPath = decodeOnce(classified.relativePath || '');
  if (!decodedPath || decodedPath.includes('\0') || decodedPath.includes('..') || decodedPath.includes(':')) {
    const error = new Error('Legacy resume path is invalid.');
    error.statusCode = 404;
    throw error;
  }

  const normalizedRelativePath = decodedPath
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .join(path.sep);
  const resolved = path.resolve(legacyUploadsRoot, normalizedRelativePath);

  if (!resolved.startsWith(legacyUploadsRoot)) {
    const error = new Error('Legacy resume path is invalid.');
    error.statusCode = 404;
    throw error;
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    const error = new Error('Resume file not found.');
    error.statusCode = 404;
    throw error;
  }

  return {
    resolvedPath: resolved,
    filename: path.basename(resolved),
    relativePath: normalizedRelativePath.replace(/\\/g, '/'),
  };
}

export function openLegacyResumeFile(value) {
  const { resolvedPath, filename } = resolveLegacyResumePath(value);
  return {
    filename,
    contentLength: fs.statSync(resolvedPath).size,
    stream: fs.createReadStream(resolvedPath),
  };
}
