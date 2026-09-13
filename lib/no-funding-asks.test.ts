/**
 * ObiLabs takes no donations and ships no "please support us" prompts.
 *
 * This scans every source file under app/ and components/ and fails if any of
 * that wording comes back. A portal support-ask route and footer link existed
 * until 2026-09; they were removed and this test keeps them removed.
 *
 * There is deliberately no allowlist. If a legitimate use ever needs one of
 * these words, change the wording rather than adding an exception.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')
const SCAN_DIRS = ['app', 'components']
const EXTENSIONS = /\.(tsx?|jsx?|mdx?|json|css)$/

const FORBIDDEN: RegExp[] = [/donat(e|ion|ing|or)/i, /please\s+support\s+us/i, /support\s+the\s+project/i]

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (EXTENSIONS.test(name)) out.push(full)
  }
  return out
}

describe('no funding asks in the product', () => {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))

  it('finds source files to scan', () => {
    // Guards against a path change silently turning this into a no-op.
    expect(files.length).toBeGreaterThan(50)
  })

  it('contains no donation or "please support us" wording', () => {
    const hits: string[] = []
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (FORBIDDEN.some((re) => re.test(line))) {
            hits.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim()}`)
          }
        })
    }
    expect(hits).toEqual([])
  })

  it('has no support-ask route', () => {
    expect(files.some((f) => /support-ask/.test(relative(ROOT, f)))).toBe(false)
  })
})
