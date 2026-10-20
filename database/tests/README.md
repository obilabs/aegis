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
scripts/test-db.sh

# One area
scripts/test-db.sh audience
```

## Running in CI

The `Database contract` job in `.github/workflows/ci.yml` runs **every**
`*.integration.test.sql` file in this directory, discovered by glob, against a
schema built the way a fresh install builds it (`init.sql`, then any migration
not already recorded in `schema_migrations`). Adding a file here is all it
takes to have it run — there is no list to update.

It used to name three files explicitly, and `mtp-pairings.integration.test.sql`
spent four months testing a table that migration 092 had dropped: it failed on
every fresh database, and nothing ever ran it. If you find yourself wanting to
exclude a file from the loop, fix or delete the file instead.

Two things a test may assume, and nothing more:

- The schema, exactly as a fresh install produces it.
- **One** organisation and **one** user, seeded by the job. Anything else — a
  contact, a ticket, an API key — the test creates itself. Prefer creating your
  own organisation too, as most files here do; it makes the file runnable
  against a dev database that is already full of real rows.

## Why SQL not vitest

The functions under test ARE SQL. Testing them from SQL means:
- No JS dependency hell (no need to spin up a Node sidecar with the
  workspace mounted just to call `query()`).
- Setup and assertions live in the same transaction — rollback guarantees
  cleanup even if assertions abort midway.
- Runs in <1s against the existing container — no `pnpm install` overhead.

For things that need TypeScript (request flows, library functions), use
the `*.test.ts` vitest pattern alongside the source file.
