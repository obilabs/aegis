#!/bin/sh
set -e

echo "============================================"
echo "Aegis - Starting up..."
echo "============================================"

# Parse DATABASE_URL to extract connection details
DB_URL="${DATABASE_URL}"

DB_HOST=$(echo "$DB_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
DB_PORT=$(echo "$DB_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "$DB_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
DB_USER=$(echo "$DB_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')

DB_PORT=${DB_PORT:-5432}

echo "Database: $DB_NAME @ $DB_HOST:$DB_PORT"
echo "Waiting for database to be ready..."

# Wait for database (max 60 seconds)
MAX_WAIT=60
for i in $(seq 1 $MAX_WAIT); do
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
        echo "Database is ready!"
        break
    fi
    if [ $i -eq $MAX_WAIT ]; then
        echo "ERROR: Database not ready after $MAX_WAIT seconds"
        exit 1
    fi
    if [ $((i % 10)) -eq 0 ]; then
        echo "Still waiting for database... ($i/$MAX_WAIT)"
    fi
    sleep 1
done

# Check if schema already exists (organizations table is a reliable marker)
echo ""
SCHEMA_EXISTS=$(psql "$DATABASE_URL" -t -A -c "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations');" 2>/dev/null || echo "f")

# Enable pgvector extension (idempotent — safe to run every startup)
echo "Enabling pgvector extension..."
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || echo "  pgvector extension already enabled or not available"

if [ "$SCHEMA_EXISTS" = "t" ]; then
    echo "Database schema already exists, skipping init.sql."
else
    echo "Fresh database detected — applying schema (init.sql)..."
    if [ -f /app/init.sql ]; then
        psql "$DATABASE_URL" -f /app/init.sql 2>&1 | tail -5
        echo "  Schema applied."
    else
        echo "  ERROR: No init.sql found!"
        exit 1
    fi
fi

# Run migrations, tracking applied versions so we never re-apply a non-idempotent
# file. Previously the loop ran every *.sql with `|| true` which silently
# corrupts data on re-runs. We aborted that pattern on 2026-05-06 when MTP's
# audit caught it; same fix applied here. Boot now ABORTS on migration failure
# rather than continuing with a partially-applied schema.
psql "$DATABASE_URL" -c "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());" > /dev/null 2>&1

MIGRATION_COUNT=0
for migration in /app/migrations/*.sql; do
    if [ -f "$migration" ]; then
        MIGRATION_NAME=$(basename "$migration" .sql)
        ALREADY_APPLIED=$(psql "$DATABASE_URL" -t -A -c "SELECT 1 FROM schema_migrations WHERE version = '$MIGRATION_NAME';" 2>/dev/null)
        if [ "$ALREADY_APPLIED" = "1" ]; then
            continue
        fi
        MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
        echo "  [$MIGRATION_COUNT] $MIGRATION_NAME"
        if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration" > /dev/null 2>&1; then
            psql "$DATABASE_URL" -c "INSERT INTO schema_migrations (version) VALUES ('$MIGRATION_NAME');" > /dev/null
        else
            echo "    ERROR: $MIGRATION_NAME failed; aborting boot."
            exit 1
        fi
    fi
done

if [ $MIGRATION_COUNT -gt 0 ]; then
    echo "  $MIGRATION_COUNT migration(s) applied."
fi

# Admin user setup — two modes (see scripts/seed-admin.mjs header for details):
#   - ADMIN_PASSWORD set   → headless seed (CI/CD / scripted deploys)
#   - ADMIN_PASSWORD empty → interactive (operator creates admin at /portal/setup)
# The script itself prints which mode it picked; this block just routes.
echo ""
if [ -n "$ADMIN_PASSWORD" ]; then
    echo "Seeding admin (ADMIN_PASSWORD provided)..."
else
    echo "ADMIN_PASSWORD not set — admin will be created at /portal/setup."
fi
if [ -f /app/apps/aegis/seed-admin.mjs ]; then
    (cd /app/apps/aegis && node seed-admin.mjs)
elif [ -f /app/seed-admin.mjs ]; then
    node /app/seed-admin.mjs
else
    echo "  No seed script found, skipping."
fi

# Secret-bootstrap durability check (spec: zero-config-secret-bootstrap).
# When the master-key env vars are omitted, the app generates + persists them
# under AEGIS_SECRETS_DIR. That dir is a bind mount, so on a fresh host Docker
# may create it root-owned while this container runs as an unprivileged user —
# in which case the keys can't persist and would be regenerated each restart.
# Warn loudly (the app still boots; see resolveSecret's in-memory fallback).
SECRETS_DIR="${AEGIS_SECRETS_DIR:-/app/data/secrets}"
mkdir -p "$SECRETS_DIR" 2>/dev/null || true
if [ -w "$SECRETS_DIR" ]; then
    echo "Secret store: $SECRETS_DIR (writable) — auto-generated keys will persist."
else
    echo "WARN: $SECRETS_DIR is NOT writable by $(id -un 2>/dev/null || echo uid $(id -u))."
    echo "      Auto-generated master keys will NOT survive a restart. Fix by"
    echo "      pre-creating it owned by the app user (uid 1001), e.g. on the host:"
    echo "        mkdir -p ./data/secrets && chown 1001:1001 ./data/secrets"
    echo "      …or set BETTER_AUTH_SECRET / CREDENTIAL_ENCRYPTION_KEY in the env."
fi

# Start the application.
#
# Workspace-aware Docker build (since auth-foundations Phase 1 / email-ingest
# brought in `@obilabs/api-scopes` as a workspace dep): Next.js standalone
# output is rooted at /app/apps/aegis/server.js, not /app/server.js. The
# standalone tree contains the workspace structure mirrored under /app.
echo ""
echo "============================================"
echo "Starting Next.js server on port ${PORT:-3000}..."
echo "============================================"
if [ -f /app/apps/aegis/server.js ]; then
    cd /app/apps/aegis
    exec node server.js
elif [ -f /app/server.js ]; then
    # Legacy non-workspace standalone layout (kept for safety).
    exec node /app/server.js
else
    echo "ERROR: server.js not found at /app/apps/aegis/server.js or /app/server.js"
    exit 1
fi
