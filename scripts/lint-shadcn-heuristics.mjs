#!/usr/bin/env node
/**
 * Partial heuristics for CLAUDE.md hard rule 5 (UI primitives: shadcn only —
 * never hand-roll sidebar, tabs, dialogs, trees, overlays).
 *
 * Flags two unambiguous tells of hand-rolling, outside `components/ui`:
 *   1. Raw `role="tablist" | "dialog" | "menu" | "tree"` in app JSX. Not
 *      flagged: role="tab" (tab-bar.tsx's viewer tabs), "img", "presentation",
 *      "toolbar", "group".
 *   2. `fixed` + `inset-0` in one className — the hand-rolled modal-backdrop
 *      tell. `absolute inset-0` (in-flow tints/measure layers) is not matched.
 *
 * Scope: `src/renderer/src`, minus vendored `components/ui` — same `SKIP_DIRS`
 * convention as `lint-escapes.mjs` / `lint-control-recipes.mjs`.
 *
 * Allowed: none.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const scanRoot = join(root, 'src', 'renderer', 'src')

const FORBIDDEN = [
  {
    re: /\brole=(["'])(tablist|dialog|menu|tree)\1/,
    label:
      'raw ARIA role for a shadcn primitive (use Tabs / Dialog / DropdownMenu / the tree primitive)',
  },
  {
    re: /\bfixed\b[^"'`\n]*\binset-0\b|\binset-0\b[^"'`\n]*\bfixed\b/,
    label:
      'fixed + inset-0 (hand-rolled overlay — use Dialog / AlertDialog / Sheet from components/ui)',
  },
]

const SKIP_DIRS = new Set(['ui', 'node_modules', 'dist', 'out'])
const ALLOWED_FILES = new Set()

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
  console.error('Hand-rolled UI primitive drift — shadcn only (CLAUDE.md rule 5):\n')
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}  ${h.label}`)
    console.error(`    ${h.snippet}`)
  }
  console.error(
    `\n${hits.length} hit(s). Load the shadcn skill and compose the vendored primitive instead.`,
  )
  process.exit(1)
}

console.log('lint-shadcn-heuristics: ok')
