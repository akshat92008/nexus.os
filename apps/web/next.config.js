/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // output: 'export',
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
