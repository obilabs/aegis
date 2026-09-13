/**
 * Guard: rich-text HTML may only reach the DOM through <SafeHtml>.
 *
 * `components/SafeHtml.tsx` sanitizes with `toSafeHtml` (lib/article-render.ts),
 * the single sanitizer for the app. Any other `dangerouslySetInnerHTML` bypasses
 * it, so this test fails when one appears. Render through <SafeHtml> instead.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = join(__dirname, '..')
const SCAN_DIRS = ['app', 'components', 'lib', 'mcp']
const ALLOWED = new Set(['components/SafeHtml.tsx'])
// JSX attribute (`dangerouslySetInnerHTML={...}`) or object key
// (`dangerouslySetInnerHTML: ...`, e.g. createElement props).
const PATTERN = /dangerouslySetInnerHTML\s*[=:]/

function walk(dir: string, out: string[]): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.(tsx?|jsx?|mjs)$/.test(name)) out.push(full)
  }
}

describe('dangerouslySetInnerHTML is only used by <SafeHtml>', () => {
  it('has no bypasses', () => {
    const files: string[] = []
    for (const d of SCAN_DIRS) walk(join(ROOT, d), files)
    const offenders = files
      .map((f) => relative(ROOT, f).split(sep).join('/'))
      .filter((rel) => !ALLOWED.has(rel) && !rel.endsWith('safe-html-usage.test.ts'))
      .filter((rel) => PATTERN.test(readFileSync(join(ROOT, rel), 'utf8')))
    expect(offenders, 'render rich text through components/SafeHtml.tsx').toEqual([])
  })

  it('direct innerHTML / insertHTML writes go through toSafeHtml', () => {
    const files: string[] = []
    for (const d of SCAN_DIRS) walk(join(ROOT, d), files)
    const offenders: string[] = []
    for (const f of files) {
      const rel = relative(ROOT, f).split(sep).join('/')
      if (rel.endsWith('safe-html-usage.test.ts')) continue
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        const writesHtml =
          /\.(innerHTML|outerHTML)\s*=(?!=)/.test(line) ||
          /insertAdjacentHTML\s*\(/.test(line) ||
          // execCommand('insertHTML', <non-literal>) — a string literal is fine
          /['"]insertHTML['"]\s*,\s*(?![\s'"])/.test(line)
        if (writesHtml && !line.includes('toSafeHtml(')) offenders.push(`${rel}:${i + 1}`)
      })
    }
    expect(offenders, 'wrap HTML written to the DOM in toSafeHtml()').toEqual([])
  })

  it('the allowed component still routes through toSafeHtml', () => {
    const src = readFileSync(join(ROOT, 'components/SafeHtml.tsx'), 'utf8')
    expect(src).toContain("from '@/lib/article-render'")
    expect(src).toContain('toSafeHtml(')
  })
})
