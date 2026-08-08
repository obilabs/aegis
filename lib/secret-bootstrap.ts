/**
 * Zero-config secret bootstrapping — spec `zero-config-secret-bootstrap`.
 *
 * Resolves a master secret in priority order:
 *   1. explicit environment variable (always wins — backward compatible +
 *      deliberate rotation + Docker-secret / secret-manager injection),
 *   2. a persisted key file at `${AEGIS_SECRETS_DIR}/<name>.key`,
 *   3. a freshly generated cryptographically-random value, persisted 0600 for
 *      reuse on every subsequent boot.
 *
 * This lets a self-hosted deploy run with a MINIMAL `.env` (URLs only) while
 * still using strong, DURABLE crypto keys — instead of throwing (the vault) or
 * silently regenerating per boot (Better Auth, which would break all sessions).
 *
 * Synchronous by design: `lib/auth.ts` reads BETTER_AUTH_SECRET at module load.
 */
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const warned = new Set<string>()

/** Directory where auto-generated key files live. Read per-call so tests and
 * runtime env overrides are honored. */
function secretsDir(): string {
  return process.env.AEGIS_SECRETS_DIR || '/app/data/secrets'
}

/**
 * Resolve a master secret. See module doc for the resolution order.
 *
 * @param name  environment-variable name (also the key-file basename)
 * @param bytes random length when generating (default 32 → 64 hex chars)
 */
export function resolveSecret(name: string, bytes = 32): string {
  // 1. Explicit env wins — do NOT touch the key file, so operator override and
  //    rotation are honored and a malformed explicit value still surfaces
  //    downstream (we don't mask it with a generated key).
  const fromEnv = process.env[name]
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim()

  // 2. Persisted key file.
  const dir = secretsDir()
  const file = join(dir, `${name}.key`)
  try {
    if (existsSync(file)) {
      const v = readFileSync(file, 'utf8').trim()
      if (v.length > 0) return v
    }
  } catch {
    /* unreadable — fall through to (3) */
  }

  // 3. Generate + persist.
  const generated = randomBytes(bytes).toString('hex')
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    writeFileSync(file, generated, { mode: 0o600 })
    if (!warned.has(name)) {
      warned.add(name)
      console.warn(
        `[secret-bootstrap] generated ${name} → ${file} (back this up — losing it orphans encrypted data)`,
      )
    }
  } catch (err) {
    // Read-only / unwritable volume: still return a usable key so the app boots,
    // but warn loudly that it will NOT survive a restart.
    if (!warned.has(name)) {
      warned.add(name)
      console.error(
        `[secret-bootstrap] could NOT persist ${name} to ${file} (${(err as Error).message}). ` +
          `Using an in-memory key that will NOT survive restart — set ${name} in the ` +
          `environment or fix the ${dir} mount.`,
      )
    }
  }
  return generated
}
