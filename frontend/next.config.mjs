import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [],
  },
  experimental: {
    // Profile photos / resume files are submitted through server actions and can
    // be up to 5 MB; the default server-action body limit is only 1 MB, which
    // made real photos fail. Raise it above the 5 MB upload cap.
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
  turbopack: {
    root: path.resolve(import.meta.dirname, '..'),
  },
};

export default nextConfig;

