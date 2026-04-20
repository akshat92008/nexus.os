/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
  webpack(config) {
    return config;
  },
};
if (process.env.NODE_ENV !== 'production' && process.env.CI !== 'true') {
  nextConfig.rewrites = async () => {
    return [
      {
        source: '/nexus-remote/:path*',
        destination: 'http://127.0.0.1:3006/api/:path*',
      },
    ];
  };
}

module.exports = nextConfig;
