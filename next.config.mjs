/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // One header fewer on every response, and one less thing to fingerprint.
  poweredByHeader: false,
  // node:sqlite is a core module; keep it out of the server bundle graph.
  serverExternalPackages: [],
  experimental: {
    serverActions: { bodySizeLimit: '1mb' },
  },

  /**
   * Three screens were merged into others, and the old paths were kept alive by
   * page components that did nothing but `redirect()`. That is the expensive way to
   * do it: a page under `g/[slug]` renders *concurrently* with the group layout, so
   * Next cannot know the page is about to redirect — every hit on a stale bookmark
   * paid for a full layout render (its own queries and all) and then threw it away,
   * twice over counting the destination. Handled here, the redirect happens before
   * any React renders at all.
   */
  async redirects() {
    return [
      { source: '/g/:slug/leaderboard', destination: '/g/:slug/standings', permanent: false },
      { source: '/g/:slug/seasons', destination: '/g/:slug/standings', permanent: false },
      { source: '/g/:slug/portfolio', destination: '/g/:slug/you', permanent: false },
    ];
  },
};

export default nextConfig;
