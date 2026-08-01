/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // node:sqlite is a core module; keep it out of the server bundle graph.
  serverExternalPackages: [],
  experimental: {
    serverActions: { bodySizeLimit: '1mb' },
  },
};

export default nextConfig;
