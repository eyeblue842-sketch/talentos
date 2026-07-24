import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env.js';

const explicitAwsCredentials = env.awsAccessKeyId && env.awsSecretAccessKey
  ? {
      accessKeyId: env.awsAccessKeyId,
      secretAccessKey: env.awsSecretAccessKey,
    }
  : undefined;

const s3Client = env.storageProvider === 's3'
  ? new S3Client({
      region: env.awsRegion,
      endpoint: env.awsS3Endpoint || undefined,
      forcePathStyle: env.awsS3ForcePathStyle,
      credentials: explicitAwsCredentials,
    })
  : null;

export function sanitizeStorageFilename(filename) {
  const ext = path.extname(String(filename || '')).toLowerCase();
  const base = path.basename(String(filename || 'file'), ext)
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);

  return `${base || 'file'}${ext}`.toLowerCase();
}

export function computeSha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function buildPrivateStorageKey(prefix, filename) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safeFilename = sanitizeStorageFilename(filename);
  const uniquePrefix = crypto.randomUUID();
  return `${prefix}/${year}/${month}/${uniquePrefix}-${safeFilename}`;
}

function resolveLocalPath(storageKey) {
  return path.resolve(process.cwd(), env.localStoragePath, storageKey);
}

export async function storePrivateFile(file, { prefix = 'resumes', metadata = {}, storageKey } = {}) {
  if (!file) return null;

  const originalFilename = sanitizeStorageFilename(file.originalname);
  const finalStorageKey = storageKey || buildPrivateStorageKey(prefix, originalFilename);
  const fileBuffer = file.buffer;
  const checksumSha256 = computeSha256Hex(fileBuffer);
  const mimeType = file.mimetype || 'application/octet-stream';
  const sizeBytes = file.size || fileBuffer?.length || 0;

  if (env.storageProvider === 's3' && s3Client) {
    await s3Client.send(new PutObjectCommand({
      Bucket: env.awsBucket,
      Key: finalStorageKey,
      Body: fileBuffer,
      ContentType: mimeType,
      Metadata: {
        originalFilename,
        checksumSha256,
        ...Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, String(value)])),
      },
    }));

    return {
      storageProvider: 's3',
      storageKey: finalStorageKey,
      originalFilename,
      mimeType,
      sizeBytes,
      checksumSha256,
    };
  }

  const fullPath = resolveLocalPath(finalStorageKey);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, fileBuffer);

  return {
    storageProvider: 'local',
    storageKey: finalStorageKey,
    originalFilename,
    mimeType,
    sizeBytes,
    checksumSha256,
  };
}

export async function deletePrivateFile(storageProvider, storageKey) {
  if (!storageKey) return;

  if (storageProvider === 's3' && s3Client) {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: env.awsBucket,
      Key: storageKey,
    }));
    return;
  }

  const fullPath = resolveLocalPath(storageKey);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
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

export async function readPrivateFileNodeStream(storageProvider, storageKey) {
  if (storageProvider === 's3' && s3Client) {
    const result = await s3Client.send(new GetObjectCommand({
      Bucket: env.awsBucket,
      Key: storageKey,
    }));

    return {
      stream: Readable.fromWeb(result.Body.transformToWebStream()),
      contentLength: result.ContentLength || undefined,
      contentType: result.ContentType || 'application/octet-stream',
    };
  }

  const fullPath = resolveLocalPath(storageKey);
  return {
    stream: fs.createReadStream(fullPath),
    contentLength: fs.statSync(fullPath).size,
    contentType: 'application/octet-stream',
  };
}

export async function createPrivateDownloadUrl(storageProvider, storageKey, {
  expiresInSeconds = 300,
  downloadFilename = null,
  mimeType = 'application/octet-stream',
} = {}) {
  if (storageProvider === 's3' && s3Client) {
    const command = new GetObjectCommand({
      Bucket: env.awsBucket,
      Key: storageKey,
      ResponseContentType: mimeType,
      ...(downloadFilename ? {
        ResponseContentDisposition: `attachment; filename="${downloadFilename.replace(/"/g, '')}"`,
      } : {}),
    });
    return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
  }

  return null;
}
