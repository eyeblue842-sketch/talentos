const INTERNAL_PROFILE_PHOTO_PREFIX = 'private:';

export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';

export function resolveCandidateProfilePhotoSrc(profileImageUrl, version = null) {
  const raw = String(profileImageUrl || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) {
    return raw;
  }

  if (raw.startsWith(INTERNAL_PROFILE_PHOTO_PREFIX)) {
    const suffix = version ? `?v=${encodeURIComponent(String(version))}` : '';
    return `/api/candidate/profile-photo${suffix}`;
  }

  return null;
}

export function validateCandidateProfilePhotoSelection(file) {
  if (!file || !file.size) {
    return 'Please choose a profile photo to upload.';
  }

  if (file.size > PROFILE_PHOTO_MAX_BYTES) {
    return 'Profile photo must be smaller than 5 MB.';
  }

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return 'Please upload a JPG, PNG, or WebP image.';
  }

  return null;
}
