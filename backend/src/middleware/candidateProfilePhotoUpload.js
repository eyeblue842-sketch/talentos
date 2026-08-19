import multer from 'multer';

const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const candidateProfilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PROFILE_PHOTO_MAX_BYTES,
    files: 1,
  },
});

export function handleCandidateProfilePhotoUpload(req, res, next) {
  candidateProfilePhotoUpload.single('photo')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      error.statusCode = 400;
      error.message = 'Profile photo must be smaller than 5 MB.';
    } else {
      error.statusCode = error.statusCode || 400;
    }

    next(error);
  });
}
