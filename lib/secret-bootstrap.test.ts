import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveSecret } from './secret-bootstrap'

describe('resolveSecret (zero-config-secret-bootstrap)', () => {
  let dir: string
  const NAME = 'TEST_MASTER_SECRET'

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'aegis-secrets-'))
    process.env.AEGIS_SECRETS_DIR = dir
    delete process.env[NAME]
  })

  afterEach(() => {
    delete process.env.AEGIS_SECRETS_DIR
    delete process.env[NAME]
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns the env value and writes no file when env is set (env wins)', () => {
    process.env[NAME] = 'explicit-operator-value'
    const v = resolveSecret(NAME)
    expect(v).toBe('explicit-operator-value')
    expect(existsSync(join(dir, `${NAME}.key`))).toBe(false)
  })

  it('trims surrounding whitespace on the env value', () => {
    process.env[NAME] = '  spaced-value  '
    expect(resolveSecret(NAME)).toBe('spaced-value')
  })

  it('generates a 64-hex key and persists it 0600 when env + file absent', () => {
    const v = resolveSecret(NAME)
    expect(v).toMatch(/^[0-9a-f]{64}$/)
    const file = join(dir, `${NAME}.key`)
    expect(existsSync(file)).toBe(true)
    expect(readFileSync(file, 'utf8').trim()).toBe(v)
  })

  it('reuses the persisted key on subsequent calls (persistence across boots)', () => {
    const first = resolveSecret(NAME)
    const second = resolveSecret(NAME)
    expect(second).toBe(first)
  })

  it('reads an existing key file rather than regenerating', () => {
    writeFileSync(join(dir, `${NAME}.key`), 'preexisting-persisted-key')
    expect(resolveSecret(NAME)).toBe('preexisting-persisted-key')
  })

  it('honors a custom byte length', () => {
    expect(resolveSecret(NAME, 16)).toMatch(/^[0-9a-f]{32}$/)
  })
})
