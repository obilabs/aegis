# Workspace-aware Docker build (build context = repo root).
#
# We're a pnpm monorepo with `apps/aegis` depending on workspace packages
# (`@obilabs/api-scopes`, `@obilabs/documents`, `@aegis/email`) via `workspace:*`. To resolve them,
# the Docker build context must include the whole workspace, not just
# apps/aegis. docker-compose.yml passes context: ../.. and dockerfile:
# apps/aegis/Dockerfile.
#
# Build flow:
#   1. Copy workspace metadata (pnpm-workspace.yaml, root package.json, lockfile)
#   2. Copy ONLY the package.json files of the projects we need (cache-friendly)
#   3. Run `pnpm install --frozen-lockfile` — populates node_modules for the workspace
#   4. Copy source for packages/{api-scopes,config,documents,email} + apps/aegis
#   5. Build workspace packages (they produce dist/ that apps/aegis consumes)
#   6. Build apps/aegis with Next.js standalone output
#   7. Runner stage copies the standalone output + DB schema/migrations

FROM node:20-alpine AS builder

WORKDIR /workspace

ENV DOCKER_BUILD=true

# Build-time args for Next.js public env vars (baked into the bundle).
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# ---- Stage 1: workspace metadata + package.json files (cache layer) ---------
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/aegis/package.json apps/aegis/
COPY packages/api-scopes/package.json packages/api-scopes/
COPY packages/config/package.json packages/config/
COPY packages/documents/package.json packages/documents/
COPY packages/email/package.json packages/email/

# Install with the workspace lockfile. Includes apps/aegis's deps + the
# workspace package skeletons.
RUN pnpm install --frozen-lockfile

# ---- Stage 2: source files --------------------------------------------------
COPY packages/config/ packages/config/
COPY packages/api-scopes/ packages/api-scopes/
COPY packages/documents/ packages/documents/
COPY packages/email/ packages/email/
COPY apps/aegis/ apps/aegis/

# ---- Stage 3: build dependencies before the app ----------------------------
# Workspace packages consumed by apps/aegis at build time; build dist/ first.
RUN pnpm --filter @obilabs/api-scopes build && pnpm --filter @obilabs/documents build && pnpm --filter @aegis/email build

# ---- Stage 4: build the Next.js app ---------------------------------------
RUN pnpm --filter @aegis/app build

# ============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache postgresql-client

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Next.js standalone with `outputFileTracingRoot` set to repo root produces a
# layout under apps/aegis/.next/standalone that mirrors the workspace tree.
# The actual server entry point ends up at:
#   apps/aegis/.next/standalone/apps/aegis/server.js
# We copy the WHOLE standalone tree (which includes node_modules + workspace
# packages) and adjust the working directory at runtime.
# --chown at copy time sets ownership in the same layer. A separate
# `RUN chown -R /app` would rewrite every file's metadata into a NEW layer,
# duplicating the whole ~122MB app tree (~128MB of pure image bloat).
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/aegis/.next/standalone/ ./
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/aegis/.next/static ./apps/aegis/.next/static
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/aegis/public ./apps/aegis/public

# DB bootstrap files (entrypoint reads from /app — keep these flat).
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/aegis/database/init.sql ./init.sql
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/aegis/database/migrations ./migrations
# seed-admin.mjs imports `pg`. With workspace-aware standalone output, pg
# lives at /app/apps/aegis/node_modules/pg — so the script must run from
# alongside server.js to resolve it.
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/aegis/scripts/seed-admin.mjs ./apps/aegis/seed-admin.mjs
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/aegis/docker-entrypoint.sh ./

RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh
# Own the WORKDIR inode itself (non-recursive — the tree is already
# nextjs-owned via --chown above, so this stays a tiny metadata-only layer).
RUN chown nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# The entrypoint runs migrations + seeds admin + then `node apps/aegis/server.js`.
ENTRYPOINT ["/app/docker-entrypoint.sh"]
