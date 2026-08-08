# Standalone Docker build for the aegis app (extracted from the obilabs monorepo).
#
# The @obilabs/* packages (email, api-scopes, documents) resolve from GitHub
# Packages, authenticated by an NPM_TOKEN BuildKit secret (never baked into a
# layer). Build with:  NPM_TOKEN=$(gh auth token) docker compose build
#
# Build flow:
#   1. Copy package.json + lockfile + .npmrc (cache layer), install from registry
#   2. Copy source, build Next.js standalone output (flat: .next/standalone/server.js)
#   3. Runner stage copies the standalone output + DB schema/migrations

FROM node:20-alpine AS builder

WORKDIR /app

ENV DOCKER_BUILD=true

# Build-time args for Next.js public env vars (baked into the bundle).
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# ---- Stage 1: deps (cache layer) — @obilabs/* from GH Packages via secret -----
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN="$(cat /run/secrets/npm_token)" pnpm install --frozen-lockfile

# ---- Stage 2: source + build --------------------------------------------------
COPY . .
RUN pnpm build

# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache postgresql-client

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Standalone output is now FLAT (app at repo root, outputFileTracingRoot=__dirname):
#   .next/standalone/server.js  (no apps/aegis nesting)
# docker-entrypoint.sh already handles both layouts (flat branch: /app/server.js).
# --chown at copy time sets ownership in the same layer (avoids a duplicate-tree
# chown layer).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/ ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# DB bootstrap files (entrypoint reads from /app).
COPY --from=builder --chown=nextjs:nodejs /app/database/init.sql ./init.sql
COPY --from=builder --chown=nextjs:nodejs /app/database/migrations ./migrations
COPY --from=builder --chown=nextjs:nodejs /app/scripts/seed-admin.mjs ./seed-admin.mjs
COPY --from=builder --chown=nextjs:nodejs /app/docker-entrypoint.sh ./

RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh
RUN chown nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# The entrypoint runs migrations + seeds admin + then `node server.js`.
ENTRYPOINT ["/app/docker-entrypoint.sh"]
