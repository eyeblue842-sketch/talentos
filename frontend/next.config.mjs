import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [],
  },
  turbopack: {
    root: path.resolve(import.meta.dirname, '..'),
  },
};

export default nextConfig;

