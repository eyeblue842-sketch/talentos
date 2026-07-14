import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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

export async function storeResume(file) {
  if (!file) return null;

  if (env.storageProvider === 's3' && s3Client) {
    const key = `${Date.now()}-${file.originalname}`;
    await s3Client.send(new PutObjectCommand({
      Bucket: env.awsBucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));
    return `https://${env.awsBucket}.s3.${env.awsRegion}.amazonaws.com/${key}`;
  }

  const uploadDir = path.resolve(process.cwd(), env.localStoragePath);
  fs.mkdirSync(uploadDir, { recursive: true });
  const filename = `${Date.now()}-${file.originalname}`.replace(/\s+/g, '-');
  const fullPath = path.join(uploadDir, filename);
  fs.writeFileSync(fullPath, file.buffer);
  return `/uploads/${filename}`;
}
