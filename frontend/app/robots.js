export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/jobs', '/companies'],
        disallow: ['/candidate', '/recruiter', '/admin', '/auth/api'],
      },
    ],
  };
}

