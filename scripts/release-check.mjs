#!/usr/bin/env node
/**
 * Pre-cut release gate. Fail closed unless origin/main HEAD is green on the
 * workflows that must pass before a version is burned.
 *
 * Usage:
 *   node scripts/release-check.mjs
 *   node scripts/release-check.mjs --sha <full-or-short>
 *   node scripts/release-check.mjs --allow-dirty   # skip clean-tree check
 *   node scripts/release-check.mjs --skip-sync     # skip origin/main sync check
 *
 * Exit 0 only when every required check is green for the target SHA.
 */
import { execFileSync } from 'node:child_process'
import { parseArgs } from 'node:util'

const REQUIRED_WORKFLOWS = [
  { file: 'ci.yml', name: 'CI' },
  { file: 'linux.yml', name: 'Linux' },
  { file: 'e2e-native-dry-run.yml', name: 'E2e native dry-run' },
]

const { values } = parseArgs({
  options: {
    sha: { type: 'string' },
    'allow-dirty': { type: 'boolean', default: false },
    'skip-sync': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
  strict: true,
})

if (values.help) {
  console.log(`Usage: node scripts/release-check.mjs [--sha SHA] [--allow-dirty] [--skip-sync]
Required green workflows on the target SHA: CI, Linux, E2e native dry-run.`)
  process.exit(0)
}

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  }).trim()
}

function shOk(cmd, args) {
  try {
    sh(cmd, args)
    return true
  } catch {
    return false
  }
}

function fail(msg) {
  console.error(`release:check ✗ ${msg}`)
  process.exit(1)
}

function ok(msg) {
  console.log(`release:check ✓ ${msg}`)
}

// --- local git gates ---
const branch = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
if (branch !== 'main') {
  fail(`must be on main (currently ${branch})`)
}
ok('on main')

if (!values['allow-dirty']) {
  const dirty = sh('git', ['status', '--porcelain'])
  if (dirty) {
    fail('working tree is dirty — commit or stash first')
  }
  ok('clean working tree')
}

if (!values['skip-sync']) {
  // Do not pass stdio: 'ignore' — sh() always .trim()s stdout; ignore returns null
  // and would crash the happy path before any workflow conclusion is checked.
  sh('git', ['fetch', 'origin', 'main', '--quiet'])
  const local = sh('git', ['rev-parse', 'HEAD'])
  const remote = sh('git', ['rev-parse', 'origin/main'])
  if (local !== remote) {
    fail(`HEAD (${local.slice(0, 7)}) ≠ origin/main (${remote.slice(0, 7)}) — push or pull first`)
  }
  ok('HEAD matches origin/main')
}

const targetSha = values.sha
  ? sh('git', ['rev-parse', values.sha])
  : sh('git', ['rev-parse', 'HEAD'])
ok(`target SHA ${targetSha.slice(0, 7)}`)

if (!shOk('gh', ['auth', 'status'])) {
  fail('gh is not authenticated — run `gh auth login`')
}

// --- required workflow conclusions for this SHA ---
const failures = []

for (const wf of REQUIRED_WORKFLOWS) {
  let runsJson
  try {
    runsJson = sh('gh', [
      'run',
      'list',
      '--workflow',
      wf.file,
      '--commit',
      targetSha,
      '--limit',
      '5',
      '--json',
      'databaseId,conclusion,status,displayTitle,url,createdAt',
    ])
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    failures.push(`${wf.name}: could not query runs (${msg})`)
    continue
  }

  /** @type {Array<{ databaseId: number, conclusion: string | null, status: string, displayTitle: string, url: string, createdAt: string }>} */
  const runs = JSON.parse(runsJson || '[]')
  if (runs.length === 0) {
    failures.push(
      `${wf.name}: no runs for ${targetSha.slice(0, 7)} — push main and wait, or trigger the workflow`,
    )
    continue
  }

  // Prefer a completed success; any in-progress means not ready; all failures = fail.
  const success = runs.find((r) => r.status === 'completed' && r.conclusion === 'success')
  if (success) {
    ok(`${wf.name} green (run ${success.databaseId})`)
    continue
  }

  const inProgress = runs.find((r) => r.status !== 'completed')
  if (inProgress) {
    failures.push(`${wf.name}: still ${inProgress.status} — ${inProgress.url}`)
    continue
  }

  const latest = runs[0]
  failures.push(`${wf.name}: latest conclusion=${latest.conclusion ?? 'null'} — ${latest.url}`)
}

if (failures.length > 0) {
  console.error('')
  console.error('release:check blocked — fix before cutting a release:')
  for (const f of failures) {
    console.error(`  • ${f}`)
  }
  console.error('')
  console.error('Tip: after landing on main, wait for CI + Linux + native dry-run,')
  console.error('then: pnpm release:cut  (or gh workflow run release.yml -f bump=patch)')
  process.exit(1)
}

console.log('')
console.log('release:check passed — safe to cut a release for this SHA.')
console.log('  pnpm release:cut          # patch (default)')
console.log('  pnpm release:cut minor')
console.log('  gh workflow run release.yml -f bump=patch')
process.exit(0)
