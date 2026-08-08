/** @type {import('next').NextConfig} */

// Parse ALLOWED_ORIGINS env var (comma-separated list of origins)
// Empty / unset = no external CORS access
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)

const nextConfig = {
  output: process.env.DOCKER_BUILD ? 'standalone' : undefined,

  // Next.js standalone tracing in a monorepo: tell Next where the workspace
  // root is so it traces transitive deps from `packages/*` correctly. Without
  // this, the standalone output misses workspace packages because Next assumes
  // node_modules is right above the app directory.
  outputFileTracingRoot: process.env.DOCKER_BUILD
    ? __dirname
    : undefined,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.obilabs.dev',
      },
    ],
  },

  serverExternalPackages: ['pg'],

  // CORS headers for external API routes (/api/ai/* and /api/v1/*)
  async headers() {
    // If no origins configured, skip CORS headers entirely
    if (allowedOrigins.length === 0) return []

    const corsHeaders = [
      { key: 'Access-Control-Allow-Origin', value: allowedOrigins.join(', ') },
      { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, DELETE, OPTIONS' },
      { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, x-api-key' },
      { key: 'Access-Control-Max-Age', value: '86400' },
    ]

    return [
      {
        source: '/api/ai/:path*',
        headers: corsHeaders,
      },
      {
        source: '/api/v1/:path*',
        headers: corsHeaders,
      },
    ]
  },
}

module.exports = nextConfig
