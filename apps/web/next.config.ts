import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  poweredByHeader: false,
  allowedDevOrigins: ['localhost', '127.0.0.1'],
};

export default nextConfig;
