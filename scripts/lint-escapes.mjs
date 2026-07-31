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
 *
 * Scope is BOTH TypeScript clients — the Electron/browser tree and the native
 * app (`apps/mobile/src`, added 2026-07-30). Hard rules 6 and 7 are about the
 * language, not about one renderer, so a fourth client must not be a place the
 * escapes come back. (The other custom gates stay Electron-only on purpose:
 * control recipes and the shadcn heuristics are renderer-surface rules — mobile
 * bans shadcn outright — and lint-audit guards daemon/main invariants.)
 *
 * One rule is mobile-ONLY: importing from the universal `@expo/ui` root
 * (hard rule 5, 2026-07-31). The native client is iOS-only and SwiftUI-only, so
 * components come from `@expo/ui/swift-ui` and modifiers from
 * `@expo/ui/swift-ui/modifiers`. The universal layer is a portability shim we no
 * longer need and a thinner API (19 components vs 51, `Text` takes a plain
 * string so it can't do spans); leaving both reachable is how you end up with
 * two idioms nobody chose. The regex matches the bare root only — the
 * `/swift-ui` subpaths are the point.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const scanRoot = join(root, 'src')
const mobileRoot = join(root, 'apps', 'mobile', 'src')

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

const MOBILE_FORBIDDEN = [
  {
    re: /(?:from|require\()\s*['"]@expo\/ui['"]/,
    label:
      'universal @expo/ui root import (rule 5: the native client is SwiftUI-only — import components from @expo/ui/swift-ui and modifiers from @expo/ui/swift-ui/modifiers, Host included)',
  },
]

const SKIP_DIRS = new Set(['node_modules', 'dist', 'out'])
// The vendored shadcn dir, excluded by PATH, not by name: a name-based `ui`
// skip would silently drop a native `ui` slice under apps/mobile/src too.
const VENDORED_UI = join(scanRoot, 'renderer', 'src', 'components', 'ui')
const ALLOWED_FILES = new Set([
  join(scanRoot, 'backend', 'static-server.test.ts'), // fakes node:http ServerResponse
  join(scanRoot, 'renderer', 'src', 'lib', 'terminal-touch-scroll.test.ts'), // fakes DOM Touch[]
])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const path = join(dir, name)
    if (path === VENDORED_UI) continue
    const st = statSync(path)
    if (st.isDirectory()) walk(path, out)
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(path)
  }
  return out
}

const hits = []

const mobileFiles = new Set(walk(mobileRoot))

for (const file of [...walk(scanRoot), ...mobileFiles]) {
  if (ALLOWED_FILES.has(file)) continue
  const rel = relative(root, file)
  const rules = mobileFiles.has(file) ? [...FORBIDDEN, ...MOBILE_FORBIDDEN] : FORBIDDEN
  const lines = readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue
    for (const { re, label } of rules) {
      if (re.test(line)) {
        hits.push({ file: rel, line: i + 1, label, snippet: line.trim().slice(0, 120) })
      }
    }
  }
}

if (hits.length > 0) {
  console.error(
    'Escape-hatch drift — `as unknown as` (rule 6), `void` on promises (rule 7), and the universal `@expo/ui` root on mobile (rule 5) are banned:\n',
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
