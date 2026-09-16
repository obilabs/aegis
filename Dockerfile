# Standalone Docker build for the aegis app (extracted from the obilabs monorepo).
#
# The @obilabs/* packages (email, api-scopes, documents) are PUBLIC on npmjs
# under the personal @obilabs scope, so they install anonymously — no token, no
# BuildKit secret, no registry override. Build with plain: docker compose build
#
# Build flow:
#   1. Copy package.json + lockfile (cache layer), install from npmjs
#   2. Copy source, build Next.js standalone output (flat: .next/standalone/server.js)
#   3. Runner stage copies the standalone output + DB schema/migrations

FROM node:26-alpine AS builder

WORKDIR /app

ENV DOCKER_BUILD=true

# Build-time args for Next.js public env vars (baked into the bundle).
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

# ---- Stage 1: deps (cache layer) — @obilabs/* public on npmjs, no token ------
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- Stage 2: source + build --------------------------------------------------
COPY . .
RUN pnpm build

# ==============================================================================
FROM node:26-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# su-exec: the entrypoint starts as root only to hand the secrets mount to the
# app user, then drops privileges (see docker-entrypoint.sh).
RUN apk add --no-cache postgresql-client su-exec

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
RUN chown nextjs:nodejs /app \
    && mkdir -p /app/data/secrets \
    && chown -R nextjs:nodejs /app/data \
    && chmod 700 /app/data/secrets

# No `USER nextjs` here: a Docker-created bind mount or named volume for
# /app/data/secrets is owned by root, and the app (uid 1001) could not persist
# its generated keys there. The entrypoint fixes ownership of that one
# directory as root and then re-executes itself as nextjs via su-exec, so the
# server never runs as root. Running with an explicit `user:` still works; the
# entrypoint then skips the ownership step and warns if the mount is read-only.

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# The entrypoint runs migrations + seeds admin + then `node server.js`.
ENTRYPOINT ["/app/docker-entrypoint.sh"]
