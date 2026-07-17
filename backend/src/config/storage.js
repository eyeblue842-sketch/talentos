import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from './env.js';

const s3Client = env.storageProvider === 's3'
  ? new S3Client({
      region: env.awsRegion,
      credentials: {
        accessKeyId: env.awsAccessKeyId,
        secretAccessKey: env.awsSecretAccessKey,
      },
    })
  : null;

function sanitizeFilename(filename) {
  return String(filename || 'file')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || `file-${Date.now()}`;
}

function resolveLocalPath(storageKey) {
  return path.resolve(process.cwd(), env.localStoragePath, storageKey);
}

export async function storePrivateFile(file, { prefix = 'resumes' } = {}) {
  if (!file) return null;

  const originalFilename = sanitizeFilename(file.originalname);
  const storageKey = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${originalFilename}`;

  if (env.storageProvider === 's3' && s3Client) {
    await s3Client.send(new PutObjectCommand({
      Bucket: env.awsBucket,
      Key: storageKey,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    return {
      storageProvider: 's3',
      storageKey,
      originalFilename,
      mimeType: file.mimetype || 'application/octet-stream',
      sizeBytes: file.size || file.buffer?.length || 0,
    };
  }

  const fullPath = resolveLocalPath(storageKey);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, file.buffer);

  return {
    storageProvider: 'local',
    storageKey,
    originalFilename,
    mimeType: file.mimetype || 'application/octet-stream',
    sizeBytes: file.size || file.buffer?.length || 0,
  };
}

export async function readPrivateFile(storageProvider, storageKey) {
  if (storageProvider === 's3' && s3Client) {
    const result = await s3Client.send(new GetObjectCommand({
      Bucket: env.awsBucket,
      Key: storageKey,
    }));

    return {
      stream: result.Body,
      contentLength: result.ContentLength || undefined,
      contentType: result.ContentType || 'application/octet-stream',
    };
  }

  const fullPath = resolveLocalPath(storageKey);
  const stats = fs.statSync(fullPath);

  return {
    stream: Readable.toWeb(fs.createReadStream(fullPath)),
    contentLength: stats.size,
    contentType: 'application/octet-stream',
  };
}

export function readPrivateFileNodeStream(storageProvider, storageKey) {
  if (storageProvider === 'local') {
    const fullPath = resolveLocalPath(storageKey);
    return {
      stream: fs.createReadStream(fullPath),
      contentLength: fs.statSync(fullPath).size,
      contentType: 'application/octet-stream',
    };
  }

  throw new Error('Node stream access is supported only for local storage in this service.');
}
