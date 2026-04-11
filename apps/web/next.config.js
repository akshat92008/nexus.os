/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // transpilePackages: ['@nexus-os/types'],
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Silence the "self is not defined" edge-runtime warning from Zustand
  webpack(config) {
    return config;
  },
};

module.exports = nextConfig;
