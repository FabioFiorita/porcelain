#!/usr/bin/env node
/**
 * Cut a release: bump version on main, tag, push, dispatch packaging.
 *
 * Side-project path: no pending branches, no multi-workflow gate.
 * Default bump is patch. Use minor/major only when the human asks.
 *
 * Usage:
 *   node scripts/release-cut.mjs              # patch
 *   node scripts/release-cut.mjs minor
 *   node scripts/release-cut.mjs major
 *   node scripts/release-cut.mjs patch --skip-push  # local bump+tag only
 */
import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'skip-push': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
  strict: true,
})

const bump = positionals[0] ?? 'patch'
if (values.help || !['patch', 'minor', 'major'].includes(bump)) {
  console.log(`Usage: node scripts/release-cut.mjs [patch|minor|major] [--skip-push]
Bumps the product version on every workspace package + CHANGELOG on main, tags vX.Y.Z,
pushes, dispatches release.yml.`)
  process.exit(values.help ? 0 : 1)
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// One product version everywhere (architecture charter). Canonical stamp is
// apps/desktop today (electron-builder + __PORCELAIN_VERSION__); becomes apps/daemon
// when that package exists. sync-versions.mjs mirrors to every apps/* and packages/*
// package.json that carries a version field. Root has no version on purpose.
const desktop = path.join(root, 'apps', 'desktop')

const CLEAN_ENV = {
  ...process.env,
  NO_COLOR: '1',
  FORCE_COLOR: '0',
  CLICOLOR: '0',
  CLICOLOR_FORCE: '0',
  GH_FORCE_TTY: '0',
  // Denies the tracked hook's Claude duplicate-skip: the bump commit below is a
  // nested git call the outer PreToolUse guard never saw, so the gate must run here.
  PORCELAIN_RELEASE_CUT: '1',
}

function sh(cmd, args, opts = {}) {
  const out = execFileSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: opts.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    env: CLEAN_ENV,
    ...opts,
  })
  // inherit stdio returns null (stdout not piped); don't .trim() it
  return typeof out === 'string' ? out.trim() : ''
}

function fail(msg) {
  console.error(`release:cut ✗ ${msg}`)
  process.exit(1)
}

const branch = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
if (branch !== 'main') fail(`must be on main (currently ${branch})`)

const dirty = sh('git', ['status', '--porcelain'])
if (dirty) fail('working tree is dirty — commit or stash first')

sh('git', ['fetch', 'origin', 'main', '--quiet'])
const local = sh('git', ['rev-parse', 'HEAD'])
const remote = sh('git', ['rev-parse', 'origin/main'])
if (local !== remote) {
  fail(`HEAD (${local.slice(0, 7)}) ≠ origin/main (${remote.slice(0, 7)}) — push or pull first`)
}

// Bump the release stamp on apps/desktop, then force every package to that
// version. sync-versions prefers apps/daemon as canonical when present — so a
// bare `sync-versions.mjs` after only bumping desktop would snap everyone
// back to the daemon's old version. Always --set the desktop stamp.
console.log(`release:cut → pnpm version ${bump} (canonical apps/desktop)`)
const ver = spawnSync('pnpm', ['version', bump, '--no-git-tag-version'], {
  cwd: desktop,
  encoding: 'utf8',
  stdio: 'inherit',
  env: CLEAN_ENV,
})
if (ver.status !== 0) process.exit(ver.status ?? 1)

const version = sh('node', ['-p', "require('./apps/desktop/package.json').version"])
const tag = `v${version}`

console.log(`release:cut → sync-versions --set ${version} (all workspace packages)`)
sh('node', ['scripts/sync-versions.mjs', '--set', version], { inherit: true })

sh('pnpm', ['changelog'], { inherit: true })
// Stage every path sync-versions writes, plus the changelog. Directories go in whole rather than
// named children: sync-versions enumerates them, so a fixed list silently drops a stamped file —
// v0.51.0 shipped with one dirty in the working tree that way. The shipped plugin is not here; it
// carries its own semver under `plugins/porcelain`.
sh('git', ['add', 'CHANGELOG.md', 'apps', 'packages', '.agents/skills'], {
  inherit: true,
})
sh('git', ['commit', '-m', `chore: release ${tag}`], { inherit: true })
sh('git', ['tag', '-a', tag, '-m', `chore: release ${tag}`], { inherit: true })
console.log(`release:cut → ${tag}`)

if (!values['skip-push']) {
  sh('git', ['push', 'origin', 'main', '--follow-tags'], { inherit: true })
  console.log(`release:cut → dispatching release.yml for ${tag}`)
  sh('gh', ['workflow', 'run', 'release.yml', '-f', `tag=${tag}`], { inherit: true })
  try {
    execFileSync('sleep', ['2'])
    const url = sh('gh', [
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
    ])
    if (url) {
      console.log(`release:cut → ${url}`)
      console.log('Watch: gh run watch --exit-status')
    }
  } catch {
    console.log('release:cut → dispatched (open Actions → Release)')
  }
} else {
  console.log('release:cut → skipped push (local tag only)')
}
