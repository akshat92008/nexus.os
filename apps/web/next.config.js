/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // transpilePackages: ['@nexus-os/types'],
  output: 'export',
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
  async rewrites() {
    return [
      {
        source: '/nexus-remote/:path*',
        destination: 'http://127.0.0.1:3006/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
