/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, 
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
      }
    ],
  },
};

module.exports = nextConfig;