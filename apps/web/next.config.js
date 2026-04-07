/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Proxy /api/* to the Express backend during development
  async rewrites() {
    return [
      {
        source:      '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },

  // Silence the "self is not defined" edge-runtime warning from Zustand
  webpack(config) {
    return config;
  },
};

module.exports = nextConfig;
