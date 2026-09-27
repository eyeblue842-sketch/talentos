import multer from 'multer';
import path from 'path';

// Image uploads for company logos. Kept separate from the resume `upload`
// middleware (which only permits PDF/Word) so the two never widen each other.
const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB is plenty for a logo
    files: 1,
  },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (!allowedExtensions.has(extension) || !allowedMimeTypes.has(file.mimetype)) {
      const error = new Error('Only PNG, JPG, WEBP or SVG logo images are allowed.');
      error.statusCode = 422;
      return callback(error);
    }
    return callback(null, true);
  },
});
