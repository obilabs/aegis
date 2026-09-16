#!/usr/bin/env bash
# Browser walk-through of a fresh self-hosted install (see e2e/README.md).
#
# Builds the app from this checkout, starts an isolated compose stack
# (project "aegis-e2e", 127.0.0.1 only, named volumes), runs the Playwright
# specs in order, saves logs, and removes the stack and its volumes.
#
#   bash e2e/run.sh                 # full run
#   KEEP_STACK=1 bash e2e/run.sh    # leave the stack up afterwards
#   E2E_PORT=18480 bash e2e/run.sh  # host port (default 18480)
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
E2E_DIR="$ROOT/e2e"
ART="$E2E_DIR/artifacts"
PORT="${E2E_PORT:-18480}"
ENV_FILE="$E2E_DIR/.env.e2e"
export AEGIS_VERSION="${AEGIS_VERSION:-local-e2e}"
export AEGIS_E2E_URL="http://localhost:${PORT}"
export AEGIS_E2E_COMPOSE="docker compose -p aegis-e2e --env-file e2e/.env.e2e -f docker-compose.yml -f e2e/compose.e2e.yml"
COMPOSE="$AEGIS_E2E_COMPOSE"

rand() { openssl rand -hex "$1"; }

# Same steps the README gives a new install: copy env.example, set the three
# required values. Plus the port/URL for a non-default port and a loopback bind.
cp env.example "$ENV_FILE"
sed -i.bak \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(rand 16)|" \
  -e "s|^S3_ACCESS_KEY=.*|S3_ACCESS_KEY=$(rand 8)|" \
  -e "s|^S3_SECRET_KEY=.*|S3_SECRET_KEY=$(rand 24)|" \
  -e "s|^PORT=.*|PORT=${PORT}|" \
  -e "s|^# BIND_HOST=.*|BIND_HOST=127.0.0.1|" \
  -e "s|^BETTER_AUTH_URL=.*|BETTER_AUTH_URL=${AEGIS_E2E_URL}|" \
  -e "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=${AEGIS_E2E_URL}|" \
  -e "s|^AEGIS_VERSION=.*|AEGIS_VERSION=${AEGIS_VERSION}|" \
  "$ENV_FILE"
rm -f "$ENV_FILE.bak"
echo "TELEMETRY_ENABLED=false" >> "$ENV_FILE"

rm -rf "$ART"
mkdir -p "$ART"

cleanup() {
  status=$?
  cd "$ROOT"
  $COMPOSE logs --no-color > "$ART/compose.log" 2>&1 || true
  if [ "${KEEP_STACK:-}" != "1" ]; then
    $COMPOSE down -v --remove-orphans > /dev/null 2>&1 || true
    rm -f "$ENV_FILE"
  fi
  exit $status
}
trap cleanup EXIT

echo "==> fresh stack (project aegis-e2e, port ${PORT})"
$COMPOSE down -v --remove-orphans > /dev/null 2>&1 || true
$COMPOSE up -d --build

echo "==> waiting for http://localhost:${PORT}/api/health"
for i in $(seq 1 150); do
  if curl -fsS "http://localhost:${PORT}/api/health" > /dev/null 2>&1; then
    echo "    healthy after $((i * 2))s"
    break
  fi
  if [ "$i" -eq 150 ]; then
    echo "stack did not become healthy" >&2
    $COMPOSE ps >&2 || true
    exit 1
  fi
  sleep 2
done

echo "==> playwright"
cd "$E2E_DIR"
npm ci --no-audit --no-fund
if [ -n "${CI:-}" ]; then
  npx playwright install --with-deps chromium
fi
npx playwright test
