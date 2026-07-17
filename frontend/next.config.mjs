import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [],
  },
  turbopack: {
    root: path.resolve(import.meta.dirname, '..'),
  },
};

export default nextConfig;

