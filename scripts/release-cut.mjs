#!/usr/bin/env node
/**
 * Trigger a CI-driven release cut after the local pre-gate passes.
 *
 * Does NOT bump/tag locally — version is burned only after package-mac and
 * package-linux are green (see .github/workflows/release.yml).
 *
 * Usage:
 *   node scripts/release-cut.mjs              # patch
 *   node scripts/release-cut.mjs minor
 *   node scripts/release-cut.mjs major
 *   node scripts/release-cut.mjs patch --skip-check
 */
import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'skip-check': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
  strict: true,
})

const bump = positionals[0] ?? 'patch'
if (values.help || !['patch', 'minor', 'major'].includes(bump)) {
  console.log(`Usage: node scripts/release-cut.mjs [patch|minor|major] [--skip-check]
Runs release:check (unless --skip-check), then dispatches release.yml.`)
  process.exit(values.help ? 0 : 1)
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
    ...opts,
  })
  if (r.status !== 0) {
    process.exit(r.status ?? 1)
  }
}

if (!values['skip-check']) {
  run(process.execPath, [path.join(root, 'scripts/release-check.mjs')])
}

console.log(`release:cut → dispatching release.yml (bump=${bump})`)
run('gh', ['workflow', 'run', 'release.yml', '-f', `bump=${bump}`])

// Best-effort: print the new run URL after a short delay for the API to index it.
try {
  execFileSync('sleep', ['2'])
  const url = execFileSync(
    'gh',
    [
      'run',
      'list',
      '--workflow',
      'release.yml',
      '--limit',
      '1',
      '--json',
      'url',
      '--jq',
      '.[0].url',
    ],
    { encoding: 'utf8', cwd: root },
  ).trim()
  if (url) {
    console.log(`release:cut → ${url}`)
    console.log('Watch: gh run watch  (or open the URL)')
  }
} catch {
  console.log('release:cut → dispatched (open Actions → Release for the run)')
}
