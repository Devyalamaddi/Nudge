/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow server actions and streaming
  experimental: {
    serverComponentsExternalPackages: ['cheerio'],
  },
};

export default nextConfig;
