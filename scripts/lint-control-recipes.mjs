#!/usr/bin/env node
/**
 * Enforce the compact control recipe (`@renderer/lib/controls.ts`).
 *
 * Biome can't ban arbitrary className substrings, so this runs as part of
 * `pnpm lint`. The architecture skill's surface recipes say: don't invent
 * `h-7 text-xs` for row/card actions — use compactButtonClass (and dense/input
 * twins). List rows that are only `h-7` + text-sm-minus are fine (not buttons).
 *
 * Allowed:
 * - src/renderer/src/lib/controls.ts (the recipe itself)
 * - src/renderer/src/components/ui/** (vendored shadcn)
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const scanRoot = join(root, 'src', 'renderer', 'src')

/**
 * Ad-hoc compact *button* scale: h-7 with text-xs (not text-xs-minus, not text-sm*).
 * Matches both orderings and cn() / template splits on one line.
 */
const FORBIDDEN = [
  {
    re: /\bh-7\b[^"'`\n]*\btext-xs\b(?!-)|(?<![\w-])\btext-xs\b(?!-)\s*[^"'`\n]*\bh-7\b/,
    label: 'h-7 + text-xs (use compactButtonClass from @renderer/lib/controls)',
  },
  {
    re: /\bh-7\b[^"'`\n]*\btext-xs-minus\b|\btext-xs-minus\b[^"'`\n]*\bh-7\b/,
    label: 'h-7 + text-xs-minus (use denseInputClass from @renderer/lib/controls)',
  },
]

const SKIP_DIRS = new Set(['ui', 'node_modules', 'dist', 'out'])
const ALLOWED_FILES = new Set([join(scanRoot, 'lib', 'controls.ts')])

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

const files = walk(scanRoot)
const hits = []

for (const file of files) {
  if (ALLOWED_FILES.has(file)) continue
  const rel = relative(root, file)
  const lines = readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*(\/\/|\*)/.test(line)) continue
    // Recipe string itself if someone redefines it
    if (line.includes('compactButtonClass') || line.includes('denseInputClass')) continue
    for (const { re, label } of FORBIDDEN) {
      if (re.test(line)) {
        hits.push({ file: rel, line: i + 1, label, snippet: line.trim().slice(0, 120) })
      }
    }
  }
}

if (hits.length > 0) {
  console.error('Control recipe drift — use @renderer/lib/controls.ts recipes:\n')
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}  ${h.label}`)
    console.error(`    ${h.snippet}`)
  }
  console.error(
    `\n${hits.length} hit(s). Import compactButtonClass / denseInputClass / rowActionClass.`,
  )
  process.exit(1)
}

console.log('lint-control-recipes: ok')
