#!/usr/bin/env node
/**
 * Escape-hatch bans Biome cannot express — `noExplicitAny` covers `any`, nothing
 * covers a double cast or a `void`-swallowed promise.
 *
 * Both TypeScript clients (the Electron tree and `apps/mobile/src`):
 *   - `as unknown as` — hard rule 6.
 *   - `void` on a promise — hard rule 7. The regex requires an identifier then
 *     `.` or `(`, so type-position `: void` and `Promise<void>` are untouched.
 *
 * Mobile only:
 *   - the universal `@expo/ui` root — hard rule 5, SwiftUI-only. Matches the bare
 *     root; the `/swift-ui` subpaths are the point.
 *
 * Comment lines are skipped — these bans are documented in the code they govern.
 * `ALLOWED_FILES` is for faking a type we do NOT own (node:http, DOM lib) in a
 * unit test; Porcelain-owned seams use structural interfaces instead, so adding
 * an entry is a deliberate act.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const scanRoot = join(root, 'apps', 'desktop', 'src')
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

/**
 * The terminal is the one surface whose chrome must agree with a palette it does not own — the
 * xterm themes baked into the generated WebView HTML. A hex literal here is how the React Native
 * frame came to paint a black border around a white terminal in light appearance: the emulator
 * followed `prefers-color-scheme` and the chrome did not follow anything. Colours come from
 * `theme/terminal-colors.ts`, which is the single place both sides are written down.
 */
const TERMINAL_FORBIDDEN = [
  {
    re: /#[0-9a-fA-F]{3,8}\b/,
    label:
      'hardcoded colour in the terminal feature (use terminalColors(scheme) from @/theme/terminal-colors, or ink()/accentColor() — a literal here silently disagrees with the xterm theme in the WebView)',
  },
]

const SKIP_DIRS = new Set(['node_modules', 'dist', 'out'])
// The vendored shadcn dir, excluded by PATH, not by name: a name-based `ui`
// skip would silently drop a native `ui` slice under apps/mobile/src too.
const VENDORED_UI = join(scanRoot, 'renderer', 'src', 'components', 'ui')
const ALLOWED_FILES = new Set([
  join(scanRoot, 'backend', 'net', 'static-server.test.ts'), // fakes node:http ServerResponse
  join(scanRoot, 'renderer', 'src', 'lib', 'terminal-touch-scroll.test.ts'), // fakes DOM Touch[]
])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const path = join(dir, name)
    if (path === VENDORED_UI) continue
    const st = statSync(path)
    if (st.isDirectory()) walk(path, out)
    else if (/\.(tsx?|jsx?)$/.test(name) && !name.endsWith('.generated.ts')) out.push(path)
  }
  return out
}

const hits = []

const mobileFiles = new Set(walk(mobileRoot))
const terminalRoot = join(mobileRoot, 'features', 'terminal')

for (const file of [...walk(scanRoot), ...mobileFiles]) {
  if (ALLOWED_FILES.has(file)) continue
  const rel = relative(root, file)
  const rules = mobileFiles.has(file)
    ? [
        ...FORBIDDEN,
        ...MOBILE_FORBIDDEN,
        ...(file.startsWith(terminalRoot) ? TERMINAL_FORBIDDEN : []),
      ]
    : FORBIDDEN
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
