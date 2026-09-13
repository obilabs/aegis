/**
 * Browser-safe constants for the first-run setup token (no node imports).
 * Server side: lib/first-run-token.ts.
 */
export const SETUP_TOKEN_HEADER = 'x-aegis-setup-token'
export const SETUP_TOKEN_STORAGE_KEY = 'aegis.setupToken'
export const SETUP_TOKEN_HINT = "docker compose logs aegis | grep 'setup token'"
