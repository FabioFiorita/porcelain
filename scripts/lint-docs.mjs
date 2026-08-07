#!/usr/bin/env node
/**
 * Keep the docs tree honest.
 *
 * docs/README.md is the index agents open when lost; a doc it does not list is a doc nobody
 * finds. And a moved tree leaves stale citations behind — the old path reads as truth until
 * the moment someone trusts it. Both regress silently, so both fail lint.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SELF = 'scripts/lint-docs.mjs'

// Directories that once held agent-facing docs. Split so this file passes its own check.
const STALE_PATHS = ['.agents/' + 'reference', '.agents/skills/audit/' + 'reference']

const SKIP_DIRS = new Set(['node_modules', '.git', 'out', 'dist', 'build', 'coverage'])

function walk(dir, exts, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), exts, out)
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(join(dir, entry.name))
    }
  }
  return out
}

const problems = []

// 1. Every doc under docs/ must be linked from docs/README.md.
const index = readFileSync(join(root, 'docs', 'README.md'), 'utf8')
for (const file of walk(join(root, 'docs'), ['.md'])) {
  const pathFromDocs = relative(join(root, 'docs'), file)
  if (pathFromDocs === 'README.md') continue
  if (!index.includes(`(${pathFromDocs})`)) {
    problems.push(`docs/${pathFromDocs} is not indexed in docs/README.md`)
  }
}

// 2. No citation of a directory the docs migration removed.
for (const file of walk(root, ['.md', '.mjs'])) {
  const path = relative(root, file)
  if (path === SELF) continue
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    for (const stale of STALE_PATHS) {
      if (line.includes(stale)) {
        problems.push(`${path}:${i + 1} cites ${stale} — that tree moved to docs/internals`)
      }
    }
  })
}

if (problems.length > 0) {
  console.error('Docs drift:\n')
  for (const problem of problems) console.error(`  ${problem}`)
  console.error('\nIndex the doc in docs/README.md, or repoint the stale path.')
  process.exit(1)
}

console.log('lint-docs: ok')
