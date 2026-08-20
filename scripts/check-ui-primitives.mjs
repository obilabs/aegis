#!/usr/bin/env node
/**
 * UI primitive ratchet.
 *
 * WHY THIS EXISTS
 * ---------------
 * CLAUDE.md has said "Forbidden to roll your own <button> — use <Button>" since
 * 2026-06-09. On 2026-08-20 the ticket detail page alone had 22 raw <button>,
 * zero <Button> and zero <Badge>. Across app/portal there were 576 raw buttons
 * in 84 files. A rule that is only written down is not a rule; this makes the
 * build fail instead.
 *
 * It is a RATCHET, not a ban. A big-bang migration of 576 call sites is not
 * reviewable, so the baseline records today's per-file counts and this check
 * enforces two things:
 *
 *   1. no file may exceed its recorded count  (you cannot make it worse)
 *   2. no NEW file may appear                 (new code uses the primitives)
 *
 * When you genuinely reduce a count, run with --update and commit the baseline.
 * The diff is then a visible record of the burn-down.
 *
 * Deliberately a plain grep-style script rather than an ESLint rule: it matches
 * the existing "No absolute machine paths" CI gate, needs no lint config, and
 * runs in a second.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const SCAN_DIR = join(ROOT, 'app', 'portal')
const BASELINE = join(ROOT, 'scripts', 'ui-primitives-baseline.json')
const UPDATE = process.argv.includes('--update')

/** Raw <button> — should be <Button> from components/ui/Button. */
const RAW_BUTTON = /<button[\s>]/g
/**
 * Ad-hoc pill: a <span> carrying its own horizontal padding AND a rounded
 * corner. That is a Badge wearing a disguise. Matching on the pair keeps false
 * positives low — a rounded avatar has no px-*, and a padded wrapper has no
 * rounded.
 */
const ADHOC_PILL = /<span className="[^"]*\bpx-[0-9.]+\b[^"]*\brounded\b[^"]*"/g

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (name.endsWith('.tsx')) out.push(p)
  }
  return out
}

function count(file) {
  const src = readFileSync(file, 'utf8')
  return {
    rawButton: (src.match(RAW_BUTTON) || []).length,
    adhocPill: (src.match(ADHOC_PILL) || []).length,
  }
}

const current = {}
for (const file of walk(SCAN_DIR)) {
  const key = relative(ROOT, file).split(sep).join('/')
  const c = count(file)
  if (c.rawButton || c.adhocPill) current[key] = c
}

if (UPDATE) {
  writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n')
  const t = Object.values(current).reduce((a, c) => a + c.rawButton + c.adhocPill, 0)
  console.log(`baseline updated: ${Object.keys(current).length} files, ${t} violations`)
  process.exit(0)
}

let baseline
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
} catch {
  console.error(`No baseline at ${BASELINE}. Generate it with:\n  node scripts/check-ui-primitives.mjs --update`)
  process.exit(1)
}

const failures = []
for (const [file, c] of Object.entries(current)) {
  const b = baseline[file]
  if (!b) {
    failures.push(
      `NEW FILE with hand-rolled UI: ${file}\n` +
      `    ${c.rawButton} raw <button>, ${c.adhocPill} ad-hoc pill span(s)\n` +
      `    Use <Button> / <Badge> from components/ui/. New code does not get an exemption.`
    )
    continue
  }
  if (c.rawButton > b.rawButton) {
    failures.push(`${file}: raw <button> went ${b.rawButton} -> ${c.rawButton}. Use <Button> from components/ui/Button.`)
  }
  if (c.adhocPill > b.adhocPill) {
    failures.push(`${file}: ad-hoc pill spans went ${b.adhocPill} -> ${c.adhocPill}. Use <Badge> from components/ui/Badge.`)
  }
}

const curTotal = Object.values(current).reduce((a, c) => a + c.rawButton + c.adhocPill, 0)
const baseTotal = Object.values(baseline).reduce((a, c) => a + c.rawButton + c.adhocPill, 0)

if (failures.length) {
  console.error('UI primitive ratchet FAILED\n')
  for (const f of failures) console.error('  - ' + f)
  console.error(
    `\n  Total: ${curTotal} (baseline ${baseTotal}).\n` +
    `  If you genuinely REDUCED a count, refresh the baseline:\n` +
    `    node scripts/check-ui-primitives.mjs --update\n`
  )
  process.exit(1)
}

const delta = baseTotal - curTotal
console.log(
  `UI primitive ratchet OK — ${curTotal} violations across ${Object.keys(current).length} files` +
  (delta > 0 ? ` (${delta} fewer than baseline; run --update to lock the win in)` : '')
)
