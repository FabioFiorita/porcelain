#!/usr/bin/env node
/**
 * EAS workflows may only be dispatched, never triggered automatically.
 *
 * A run spends ~2.4 minutes of the monthly workflow allowance on `fingerprint`
 * + `update` before anything reaches a tester, and a `build` job spends one of
 * the capped monthly iOS builds whenever the fingerprint moves. A `push`,
 * `pull_request`, `schedule`, or App Store Connect trigger ties both to commit
 * rate, which this repo exceeds by an order of magnitude.
 *
 * So `workflow_dispatch` is the only key allowed under `on:`. Raise the EAS plan
 * before deleting this check.
 *
 * The scan is textual — the repo has no YAML parser, and `on:`'s immediate
 * children are the whole question.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const WORKFLOW_DIRS = [join(root, 'apps', 'mobile', '.eas', 'workflows')]

const ALLOWED = new Set(['workflow_dispatch'])

/**
 * The keys nested directly under a top-level `on:`, with their line numbers.
 * A top-level key is at indent 0; the block ends at the next one.
 */
function triggerKeys(source) {
  const lines = source.split('\n')
  const keys = []
  let inBlock = false
  let blockIndent = null

  for (const [index, line] of lines.entries()) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue
    const indent = line.length - line.trimStart().length

    if (!inBlock) {
      if (indent === 0 && /^on:/.test(line)) inBlock = true
      continue
    }
    if (indent === 0) break // the `on:` block ended

    // The first nested line sets the depth that counts as a trigger name;
    // anything deeper is that trigger's own config (branches, paths, types).
    if (blockIndent === null) blockIndent = indent
    if (indent > blockIndent) continue

    const match = /^([A-Za-z_][A-Za-z0-9_]*):/.exec(line.trim())
    if (match !== null) keys.push({ key: match[1], line: index + 1 })
  }
  return keys
}

function selfCheck() {
  const banned = [
    'on:\n  push:\n    branches: ["main"]\n',
    'on:\n  schedule:\n    - cron: "0 0 * * *"\n',
  ]
  for (const probe of banned) {
    if (triggerKeys(probe).every((k) => ALLOWED.has(k.key))) {
      throw new Error(`lint-eas-triggers self-check: missed a banned trigger in\n${probe}`)
    }
  }
  // A `branches` list that happens to contain `push` must not read as a trigger,
  // and a `jobs:` key after the block must not leak in.
  const ok =
    'on:\n  workflow_dispatch:\n    inputs:\n      push:\n        type: boolean\n\njobs:\n  a:\n    type: build\n'
  const found = triggerKeys(ok).map((k) => k.key)
  if (found.length !== 1 || found[0] !== 'workflow_dispatch') {
    throw new Error(`lint-eas-triggers self-check: expected [workflow_dispatch], got [${found}]`)
  }
}

selfCheck()

const hits = []
for (const dir of WORKFLOW_DIRS.filter((d) => existsSync(d))) {
  for (const name of readdirSync(dir)) {
    if (!/\.ya?ml$/.test(name)) continue
    const path = join(dir, name)
    for (const { key, line } of triggerKeys(readFileSync(path, 'utf8'))) {
      if (!ALLOWED.has(key)) hits.push({ file: relative(root, path), key, line })
    }
  }
}

if (hits.length > 0) {
  console.error('Automatic EAS workflow triggers — these spend the monthly plan allowance:\n')
  for (const h of hits) console.error(`  ${h.file}:${h.line}  on.${h.key}`)
  console.error(
    `\n${hits.length} hit(s). Delivery is dispatched: \`eas workflow:run <file>\`. Raise the EAS plan before allowing a trigger here.`,
  )
  process.exit(1)
}

console.log('lint-eas-triggers: ok')
