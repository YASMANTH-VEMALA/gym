import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  transpilePackages: ['@gym/ui'],
  distDir: process.env.NEXT_DIST_DIR || '.next',
  logging: { incomingRequests: false },
  allowedDevOrigins: ['127.0.0.1'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};
export default nextConfig;
