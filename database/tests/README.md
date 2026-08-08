# Database integration tests

SQL functions and triggers tested directly against the running Postgres
container. Each test file is wrapped in `BEGIN`/`ROLLBACK` so the DB stays
clean; PL/pgSQL `ASSERT` statements fail fast with a clear message and
`psql -v ON_ERROR_STOP=1` makes that propagate to a non-zero exit code.

## Layout

- `<area>.integration.test.sql` — one file per logical area (e.g. `audience`,
  `threading`). Inside, group cases as `T01`, `T02`, ... so a failure shows
  exactly which assertion broke.

## Running

```bash
# All tests
apps/aegis/scripts/test-db.sh

# One area
apps/aegis/scripts/test-db.sh audience
```

## Why SQL not vitest

The functions under test ARE SQL. Testing them from SQL means:
- No JS dependency hell (no need to spin up a Node sidecar with the
  workspace mounted just to call `query()`).
- Setup and assertions live in the same transaction — rollback guarantees
  cleanup even if assertions abort midway.
- Runs in <1s against the existing container — no `pnpm install` overhead.

For things that need TypeScript (request flows, library functions), use
the `*.test.ts` vitest pattern alongside the source file.
