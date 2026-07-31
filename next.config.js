/** @type {import('next').NextConfig} */
const nextConfig = {
  // Off: double-mount in StrictMode interferes with wallet extension prompts
  reactStrictMode: false,
  // Allow both localhost and 127.0.0.1 in dev (otherwise /_next chunks can fail → blank page)
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  async rewrites() {
    return [
      {
        source: '/rpc',
        destination: 'https://rpc.pulsechain.com',
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'ethers'];
    }
    return config;
  },
};

module.exports = nextConfig;