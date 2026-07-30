#!/usr/bin/env node
/**
 * Enforce the escape-hatch bans Biome can't express:
 *   - `as unknown as` (hard rule 6: let type-safety drive the design — when
 *     types fight you, change the design).
 *   - `void`-prefixed calls (hard rule 7: no `void` on promises).
 *
 * Biome has no rule for either (`noExplicitAny` covers `any`, nothing covers a
 * double cast or a `void`-swallowed promise), so this runs as part of
 * `pnpm lint`. Both were prose-only until 2026-07-29 — making them real is what
 * lets CLAUDE.md stop restating them.
 *
 * The `void` regex requires an identifier followed by `.` or `(`, so it catches
 * `void foo()` / `void utils.x.invalidate()` and leaves type-position `: void`
 * (and `Promise<void>`) alone.
 *
 * Comment lines are skipped: the ban is *documented* in `file-watch.ts` and
 * `menu.ts`, and a naive grep counts those as violations.
 *
 * Allowed — faking a type we do NOT own (node:http, DOM lib) in a unit test.
 * Our own seams use structural interfaces instead (see `FileWatchSender` in
 * file-watch.ts, `TerminalSender` in terminal-manager.ts), so this list should
 * not grow for Porcelain-owned types. Adding to it is a deliberate act.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const scanRoot = join(root, 'src')

const FORBIDDEN = [
  {
    re: /\bas\s+unknown\s+as\b/,
    label: 'as unknown as (change the design or use a structural interface)',
  },
  {
    re: /\bvoid\s+[a-zA-Z_$][a-zA-Z0-9_$]*[.(]/,
    label:
      'void on a promise (use async/await, or await Promise.all([...]); a bare fire-and-forget call without `void` is fine)',
  },
]

const SKIP_DIRS = new Set(['ui', 'node_modules', 'dist', 'out'])
const ALLOWED_FILES = new Set([
  join(scanRoot, 'backend', 'static-server.test.ts'), // fakes node:http ServerResponse
  join(scanRoot, 'renderer', 'src', 'lib', 'terminal-touch-scroll.test.ts'), // fakes DOM Touch[]
])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) walk(path, out)
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(path)
  }
  return out
}

const hits = []

for (const file of walk(scanRoot)) {
  if (ALLOWED_FILES.has(file)) continue
  const rel = relative(root, file)
  const lines = readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue
    for (const { re, label } of FORBIDDEN) {
      if (re.test(line)) {
        hits.push({ file: rel, line: i + 1, label, snippet: line.trim().slice(0, 120) })
      }
    }
  }
}

if (hits.length > 0) {
  console.error(
    'Escape-hatch drift — `as unknown as` (rule 6) and `void` on promises (rule 7) are banned:\n',
  )
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}  ${h.label}`)
    console.error(`    ${h.snippet}`)
  }
  console.error(
    `\n${hits.length} hit(s). Prefer a structural interface at the seam, a zod parse, or a narrowing type guard; for promises, await them.`,
  )
  process.exit(1)
}

console.log('lint-escapes: ok')
