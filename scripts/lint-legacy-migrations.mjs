#!/usr/bin/env node
/**
 * PDT-005 permanent guard: the home→repo and active-review-layout migrations are gone. Fail if any
 * production source under apps/ or packages/ reintroduces the deleted modules or names.
 *
 * Historical mentions inside this script's own forbidden list are the only survivors.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const FORBIDDEN =
  /ensureProjectCompanion|resetProjectCompanionMemo|hasProjectCompanion|migrateActiveReviewLayout|trustMigratedCommands|reviewSetsPath|loopEvidenceRoot|migrate-home|migrate-active-review/
const ALLOWED_RELATIVE = new Set([
  // This guard documents the forbidden tokens.
  'scripts/lint-legacy-migrations.mjs',
])

const hits = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'out' || name === 'dist' || name === '.git') continue
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) {
      walk(path)
      continue
    }
    if (!/\.(ts|tsx|js|mjs|json)$/.test(name)) continue
    const rel = relative(root, path).split('\\').join('/')
    if (ALLOWED_RELATIVE.has(rel)) continue
    if (!rel.startsWith('apps/') && !rel.startsWith('packages/')) continue
    const text = readFileSync(path, 'utf8')
    for (const [i, line] of text.split('\n').entries()) {
      if (FORBIDDEN.test(line)) hits.push(`${rel}:${i + 1}:${line.trim()}`)
    }
  }
}

walk(join(root, 'apps'))
walk(join(root, 'packages'))

if (hits.length > 0) {
  console.error('lint-legacy-migrations: forbidden legacy migration surface still referenced:')
  for (const hit of hits) console.error(`  ${hit}`)
  process.exit(1)
}

console.log('lint-legacy-migrations: ok — zero home→repo / active-review migration hits')
