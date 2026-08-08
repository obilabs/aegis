import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  // ignoreConfigErrors tolerates any workspace tsconfig quirk during path
  // resolution; apps/aegis only needs apps/aegis/tsconfig.json. (apps/mdm and
  // apps/rmm were dropped 2026-07-22 — endpoint management is an integration.)
  plugins: [tsconfigPaths({ ignoreConfigErrors: true })],
  test: {
    // Pure-function tests only at the moment — no DB, no IMAP, no Next.js
    // runtime. Integration tests against Dovecot/Postgres run separately.
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
    environment: 'node',
    globals: false,
    // Tests should be deterministic and fast — fail loudly if not.
    reporters: ['default'],
  },
})
