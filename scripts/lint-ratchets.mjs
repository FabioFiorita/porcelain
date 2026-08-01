#!/usr/bin/env node
/**
 * Ratchets: limits that may only tighten, never loosen.
 *
 * Two checks, both driven by `scripts/ratchets.json`:
 *   - fileSize  — a source file may not exceed `max` lines, or its own recorded
 *                 entry if it is allowlisted.
 *   - hookTests — every module in the renderer hooks directory needs a sibling
 *                 `.test.ts(x)`, unless it is allowlisted.
 *
 * A stale allowlist entry is a FAILURE, not a shrug: once a file drops under the
 * cap or gains a test, its entry must go. That is the whole mechanism — the lists
 * cannot stand still, so cleaning up is the only way to keep the gate green.
 * Adding an entry is a deliberate act that shows up in review.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const config = JSON.parse(readFileSync(join(root, 'scripts', 'ratchets.json'), 'utf8'))

const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', 'dist-daemon', '.git', 'ios'])
const VENDORED_UI = join(root, 'apps', 'desktop', 'src', 'renderer', 'src', 'components', 'ui')
const HOOKS_DIR = join(root, 'apps', 'desktop', 'src', 'renderer', 'src', 'hooks')

const SCAN_ROOTS = [
  join(root, 'apps', 'desktop', 'src'),
  join(root, 'apps', 'mobile', 'src'),
  join(root, 'packages'),
].filter((dir) => existsSync(dir))

/** Matches `wc -l`: the newline that terminates the last line does not open a new one. */
const countLines = (text) => (text === '' ? 0 : text.replace(/\n$/, '').split('\n').length)

const isTest = (path) => /\.test\.tsx?$/.test(path)
/** Test infrastructure is exercised by the tests that import it, not by its own spec. */
const isTestHarness = (path) => /test-harness/.test(path)

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const path = join(dir, name)
    if (path === VENDORED_UI) continue
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(path)
  }
  return out
}

const failures = []
const stale = []

function checkFileSize(files) {
  const { max, allow } = config.fileSize
  const seen = new Set()
  for (const file of files) {
    if (isTest(file)) continue
    const rel = relative(root, file)
    const lines = countLines(readFileSync(file, 'utf8'))
    const cap = Object.hasOwn(allow, rel) ? allow[rel] : max
    if (Object.hasOwn(allow, rel)) {
      seen.add(rel)
      if (lines <= max) {
        stale.push(`fileSize: ${rel} is now ${lines} lines (under ${max}) — drop its entry`)
        continue
      }
    }
    if (lines > cap) {
      const why = cap === max ? `over the ${max}-line cap` : `over its recorded ${cap}`
      failures.push(`fileSize: ${rel} is ${lines} lines, ${why}`)
    }
  }
  for (const rel of Object.keys(allow)) {
    if (!seen.has(rel)) stale.push(`fileSize: ${rel} no longer exists — drop its entry`)
  }
}

function checkHookTests() {
  const allow = new Set(config.hookTests.allow)
  const seen = new Set()
  for (const name of readdirSync(HOOKS_DIR)) {
    const path = join(HOOKS_DIR, name)
    if (!/\.tsx?$/.test(name) || isTest(path) || isTestHarness(path)) continue
    const rel = relative(root, path)
    const base = path.replace(/\.tsx?$/, '')
    const tested = existsSync(`${base}.test.ts`) || existsSync(`${base}.test.tsx`)
    if (allow.has(rel)) {
      seen.add(rel)
      if (tested) stale.push(`hookTests: ${rel} now has a test — drop its entry`)
      continue
    }
    if (!tested) failures.push(`hookTests: ${rel} has no sibling .test.ts(x)`)
  }
  for (const rel of allow) {
    if (!seen.has(rel)) stale.push(`hookTests: ${rel} no longer exists — drop its entry`)
  }
}

checkFileSize(SCAN_ROOTS.flatMap((dir) => walk(dir)))
checkHookTests()

if (failures.length > 0 || stale.length > 0) {
  if (failures.length > 0) {
    console.error('Ratchet violations — these limits may only tighten:\n')
    for (const line of failures) console.error(`  ${line}`)
  }
  if (stale.length > 0) {
    console.error('\nStale allowlist entries — the debt is paid, remove the record:\n')
    for (const line of stale) console.error(`  ${line}`)
  }
  console.error(
    `\n${failures.length} violation(s), ${stale.length} stale. Edit scripts/ratchets.json.`,
  )
  process.exit(1)
}

console.log('lint-ratchets: ok')
