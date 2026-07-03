/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep dev assets separate from production build output. Running
  // `next build` while `next dev` is active must not corrupt served chunks.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_NODE_API_URL || 'http://localhost:3001'}/api/:path*`,
      },
      {
        source: '/ai/:path*',
        destination: `${process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000'}/ai/:path*`,
      },
    ];
  },
};

export default nextConfig;
