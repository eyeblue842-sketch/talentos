import crypto from 'crypto';
import { env } from '../config/env.js';

function badEncryptionConfiguration() {
  const error = new Error('Meeting provider encryption is not configured.');
  error.statusCode = 503;
  return error;
}

function resolveKeyBuffer() {
  const raw = env.meetingTokenEncryptionKey;
  if (!raw) return null;

  if (/^[A-Fa-f0-9]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  try {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    return null;
  }

  return null;
}

function getKeyBuffer() {
  const key = resolveKeyBuffer();
  if (!key || key.length !== 32) {
    throw badEncryptionConfiguration();
  }
  return key;
}

export function encryptMeetingSecret(plaintext) {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKeyBuffer(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  });
}

export function decryptMeetingSecret(encryptedValue) {
  if (!encryptedValue) return null;
  const parsed = JSON.parse(encryptedValue);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getKeyBuffer(),
    Buffer.from(parsed.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(parsed.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

export function hasMeetingEncryptionConfigured() {
  try {
    return Boolean(getKeyBuffer());
  } catch {
    return false;
  }
}
