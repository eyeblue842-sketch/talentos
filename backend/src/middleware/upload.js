import multer from 'multer';
import path from 'path';
import { env } from '../config/env.js';

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const allowedExtensions = new Set(['.pdf', '.doc', '.docx']);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.fileUploadMaxMb * 1024 * 1024,
    files: 1,
  },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (!allowedExtensions.has(extension) || !allowedMimeTypes.has(file.mimetype)) {
      const error = new Error('Only PDF and Word resume uploads are allowed.');
      error.statusCode = 422;
      return callback(error);
    }
    return callback(null, true);
  },
});
