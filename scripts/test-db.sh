#!/usr/bin/env bash
# Run SQL integration tests against the running aegis_db container.
#
# Each test file lives in apps/aegis/database/tests/ and is wrapped in
# BEGIN/ROLLBACK so the DB is left untouched. PL/pgSQL ASSERT statements
# fail fast with a clear message; psql -v ON_ERROR_STOP=1 propagates the
# failure to a non-zero exit code.
#
# Usage:
#   apps/aegis/scripts/test-db.sh                  # run all tests
#   apps/aegis/scripts/test-db.sh audience         # run a specific test by name

set -euo pipefail

CONTAINER="${AEGIS_DB_CONTAINER:-aegis_db}"
TEST_DIR="$(cd "$(dirname "$0")/../database/tests" && pwd)"
PATTERN="${1:-*}"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "Error: container '${CONTAINER}' is not running. Start the stack first." >&2
  exit 1
fi

shopt -s nullglob
files=( "${TEST_DIR}"/${PATTERN}.integration.test.sql )
if [ ${#files[@]} -eq 0 ]; then
  echo "No test files matching '${PATTERN}.integration.test.sql' in ${TEST_DIR}" >&2
  exit 1
fi

failures=0
for f in "${files[@]}"; do
  name="$(basename "$f")"
  echo "── ${name}"
  if docker exec -i "${CONTAINER}" psql -U aegis -d aegis -v ON_ERROR_STOP=1 -q < "$f" 2>&1; then
    echo "   PASS"
  else
    echo "   FAIL"
    failures=$((failures + 1))
  fi
done

if [ "${failures}" -gt 0 ]; then
  echo ""
  echo "${failures} test file(s) failed."
  exit 1
fi

echo ""
echo "All test files passed."
