#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const CONFIG_FILE = '.porcelain-worktree.json'
const BRANCH_PREFIX = 'work/'
const PORT_MIN = 43200
const PORT_MAX = 43999

function fail(message) {
  console.error(`worktree ✗ ${message}`)
  process.exit(1)
}

function run(cwd, command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      ...options,
    })?.trim()
  } catch (error) {
    const stderr =
      error && typeof error === 'object' && 'stderr' in error ? String(error.stderr).trim() : ''
    fail(stderr || `${command} ${args.join(' ')} failed`)
  }
}

function git(cwd, args, options) {
  return run(cwd, 'git', args, options)
}

function checked(cwd, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    env: process.env,
  })
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `${command} ${args.join(' ')} failed`)
  }
  return result.stdout?.trim() ?? ''
}

function repoRoot(cwd = process.cwd()) {
  return realpathSync(git(cwd, ['rev-parse', '--show-toplevel']))
}

function primaryRoot(cwd = process.cwd()) {
  const common = git(cwd, ['rev-parse', '--git-common-dir'])
  const commonPath = realpathSync(resolve(repoRoot(cwd), common))
  return realpathSync(dirname(commonPath))
}

function validateSlug(value) {
  const slug = value?.trim()
  if (!slug || !/^[a-z0-9][a-z0-9-]{1,47}$/.test(slug)) {
    fail('slug must be 2–48 lowercase letters, numbers, or hyphens')
  }
  return slug
}

function managedPaths(slug) {
  return {
    home: join(homedir(), '.porcelain-dev-worktrees', slug),
    userData: join(homedir(), '.local', 'share', 'porcelain-dev-worktrees', slug),
    playground: join(homedir(), 'code', 'porcelain-playgrounds', slug),
  }
}

function parseWorktrees(root) {
  return git(root, ['worktree', 'list', '--porcelain'])
    .split('\n\n')
    .map((block) => {
      const lines = block.split('\n')
      const path = lines.find((line) => line.startsWith('worktree '))?.slice(9)
      const branch = lines.find((line) => line.startsWith('branch refs/heads/'))?.slice(18)
      return path ? { path: realpathSync(path), branch: branch ?? null } : null
    })
    .filter(Boolean)
}

function readConfig(worktreePath) {
  const path = join(worktreePath, CONFIG_FILE)
  if (!existsSync(path)) return null
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'))
    const slug = validateSlug(value.slug)
    const branch = `${BRANCH_PREFIX}${slug}`
    if (
      value.version !== 1 ||
      value.branch !== branch ||
      !Number.isInteger(value.port) ||
      value.port < PORT_MIN ||
      value.port > PORT_MAX
    ) {
      fail(`${path} is invalid; remove and recreate this managed worktree`)
    }
    return { version: 1, slug, branch, port: value.port }
  } catch (error) {
    fail(`${path} is unreadable: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function writeConfig(worktreePath, config) {
  const path = join(worktreePath, CONFIG_FILE)
  const tmp = `${path}.tmp`
  writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
  renameSync(tmp, path)
}

function allocatePort(root) {
  const used = new Set(
    parseWorktrees(root)
      .map((worktree) => readConfig(worktree.path)?.port)
      .filter((port) => port !== undefined),
  )
  for (let port = PORT_MIN; port <= PORT_MAX; port++) {
    if (!used.has(port)) return port
  }
  fail(`no free managed development port in ${PORT_MIN}–${PORT_MAX}`)
}

function createPlayground(path, slug) {
  if (existsSync(path)) fail(`playground already exists: ${path}`)
  mkdirSync(join(path, 'src'), { recursive: true })
  writeFileSync(
    join(path, 'README.md'),
    `# Porcelain playground: ${slug}\n\nDisposable fixture repository for the ${slug} worktree.\n`,
  )
  writeFileSync(join(path, 'src', 'example.ts'), "export const greeting = 'hello porcelain'\n")
  checked(path, 'git', ['init', '-b', 'main'])
  checked(path, 'git', ['add', '.'])
  checked(path, 'git', [
    '-c',
    'user.name=Porcelain Playground',
    '-c',
    'user.email=playground@localhost',
    'commit',
    '-m',
    'chore: initialize playground',
  ])
}

function installDependencies(path) {
  const result = spawnSync('pnpm', ['install', '--frozen-lockfile'], {
    cwd: path,
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0) throw new Error(`dependency install failed in ${path}`)
}

function assertPrimaryMain(root) {
  if (repoRoot() !== root) fail('create must run from the primary checkout, not a task worktree')
  const branch = git(root, ['branch', '--show-current'])
  if (branch !== 'main') fail(`create must run from main (currently ${branch || 'detached'})`)
  const dirty = git(root, ['status', '--porcelain'])
  if (dirty !== '') {
    fail('primary main is dirty; commit/integrate the current unit before creating a task worktree')
  }
}

function create(slugArg, options) {
  const slug = validateSlug(slugArg)
  const root = primaryRoot()
  assertPrimaryMain(root)

  const branch = `${BRANCH_PREFIX}${slug}`
  const paths = managedPaths(slug)
  const parent = join(dirname(root), `${basename(root)}-worktrees`)
  const path = join(parent, slug)
  if (existsSync(path)) fail(`worktree path already exists: ${path}`)
  if (git(root, ['branch', '--list', branch]) !== '') fail(`branch already exists: ${branch}`)
  for (const target of Object.values(paths)) {
    if (existsSync(target)) fail(`managed runtime path already exists: ${target}`)
  }

  mkdirSync(parent, { recursive: true })
  const port = allocatePort(root)
  git(root, ['worktree', 'add', '-b', branch, path, 'main'], { inherit: true })

  try {
    writeConfig(path, { version: 1, slug, branch, port })
    createPlayground(paths.playground, slug)
    if (!options.skipInstall) installDependencies(path)
  } catch (error) {
    console.error('worktree · setup failed; rolling back the partial checkout')
    spawnSync('git', ['worktree', 'remove', '--force', path], { cwd: root, stdio: 'ignore' })
    spawnSync('git', ['branch', '-D', branch], { cwd: root, stdio: 'ignore' })
    for (const target of Object.values(paths)) {
      if (existsSync(target)) rmSync(target, { recursive: true, force: true })
    }
    throw error
  }

  console.log(`worktree ✓ created ${branch}

  checkout    ${path}
  port        ${port}
  channels    ${paths.home}
  user data   ${paths.userData}
  playground  ${paths.playground}

  cd ${path}
  pnpm build && pnpm dev:daemon -- --loopback
  pnpm porcelain review set ...

Push ${branch}, open a PR into main, then update main and run:
  pnpm worktree remove ${slug}
`)
}

function statusWithoutMetadata(path) {
  return git(path, ['status', '--porcelain', '--untracked-files=all'])
    .split('\n')
    .filter((line) => line !== '' && line.slice(3) !== CONFIG_FILE)
}

function isAncestorMerged(root, branch) {
  return (
    spawnSync('git', ['merge-base', '--is-ancestor', branch, 'main'], {
      cwd: root,
      stdio: 'ignore',
    }).status === 0
  )
}

function mergedPullRequest(root, branch) {
  const result = spawnSync(
    'gh',
    [
      'pr',
      'list',
      '--head',
      branch,
      '--base',
      'main',
      '--state',
      'merged',
      '--limit',
      '1',
      '--json',
      'number,mergedAt,headRefOid',
    ],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  )
  if (result.status !== 0) return null
  try {
    const rows = JSON.parse(result.stdout)
    return rows[0] ?? null
  } catch {
    return null
  }
}

function mergeStatus(root, branch) {
  if (isAncestorMerged(root, branch)) return { merged: true, kind: 'ancestor', pr: null }
  const pr = mergedPullRequest(root, branch)
  const branchTip = git(root, ['rev-parse', branch])
  return pr?.headRefOid === branchTip
    ? { merged: true, kind: 'pull-request', pr }
    : { merged: false, kind: null, pr: null }
}

function assertLocalMainContainsOrigin(root) {
  git(root, ['fetch', 'origin', 'main', '--quiet'])
  const current = spawnSync('git', ['merge-base', '--is-ancestor', 'origin/main', 'main'], {
    cwd: root,
    stdio: 'ignore',
  })
  if (current.status !== 0) {
    fail('local main is behind origin/main; update the primary checkout before cleanup')
  }
}

function safeManagedTarget(target, expectedParent) {
  const resolved = resolve(target)
  const parent = resolve(expectedParent)
  if (resolved === parent || !resolved.startsWith(`${parent}${sep}`)) {
    fail(`refusing to delete path outside ${parent}: ${resolved}`)
  }
}

function recordedDaemon(worktreePath, home) {
  const path = join(home, 'dev-daemon.json')
  if (!existsSync(path)) return null
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'))
    if (
      !Number.isInteger(value.pid) ||
      value.pid <= 1 ||
      realpathSync(value.worktreeRoot) !== realpathSync(worktreePath)
    ) {
      return null
    }
    return { pid: value.pid, path }
  } catch {
    return null
  }
}

function processIsManagedDaemon(pid, worktreePath) {
  try {
    process.kill(pid, 0)
  } catch {
    return false
  }

  if (process.platform === 'linux') {
    try {
      const cwd = realpathSync(readlinkSync(`/proc/${pid}/cwd`))
      const command = readFileSync(`/proc/${pid}/cmdline`, 'utf8').replaceAll('\0', ' ')
      return cwd === realpathSync(worktreePath) && command.includes('scripts/dev-daemon.mjs')
    } catch {
      return false
    }
  }

  const command = spawnSync('ps', ['-p', String(pid), '-o', 'command='], {
    encoding: 'utf8',
  }).stdout
  return command.includes('scripts/dev-daemon.mjs') && command.includes(worktreePath)
}

async function stopDaemon(worktreePath, home) {
  const record = recordedDaemon(worktreePath, home)
  if (!record) return
  if (!processIsManagedDaemon(record.pid, worktreePath)) {
    rmSync(record.path, { force: true })
    return
  }
  process.kill(record.pid, 'SIGTERM')
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      process.kill(record.pid, 0)
      await delay(100)
    } catch {
      return
    }
  }
  fail(`daemon pid ${record.pid} did not stop; stop it manually and retry`)
}

function findManaged(root, slugArg) {
  const slug = validateSlug(slugArg)
  const match = parseWorktrees(root).find((entry) => readConfig(entry.path)?.slug === slug)
  if (!match) fail(`managed worktree not found: ${slug}`)
  const config = readConfig(match.path)
  if (match.branch !== config.branch) {
    fail(`${match.path} is on ${match.branch ?? 'detached HEAD'}, expected ${config.branch}`)
  }
  return { ...match, config }
}

async function remove(slugArg, options = {}) {
  const root = primaryRoot()
  const worktree = findManaged(root, slugArg)
  const { slug, branch } = worktree.config
  const paths = managedPaths(slug)

  if (!options.force) {
    const dirty = statusWithoutMetadata(worktree.path)
    if (dirty.length > 0) {
      fail(`worktree has uncommitted changes:\n${dirty.map((line) => `  ${line}`).join('\n')}`)
    }
    const merge = mergeStatus(root, branch)
    if (!merge.merged) {
      fail(`${branch} is not merged into local main; merge the PR and update main first`)
    }
    if (merge.kind === 'pull-request') assertLocalMainContainsOrigin(root)
  }

  await stopDaemon(worktree.path, paths.home)
  git(root, ['worktree', 'remove', ...(options.force ? ['--force'] : []), worktree.path])
  const ancestryMerged = isAncestorMerged(root, branch)
  git(root, ['branch', options.force || !ancestryMerged ? '-D' : '-d', branch])

  safeManagedTarget(paths.home, join(homedir(), '.porcelain-dev-worktrees'))
  safeManagedTarget(paths.userData, join(homedir(), '.local', 'share', 'porcelain-dev-worktrees'))
  safeManagedTarget(paths.playground, join(homedir(), 'code', 'porcelain-playgrounds'))
  for (const target of Object.values(paths)) rmSync(target, { recursive: true, force: true })

  console.log(`worktree ✓ removed ${branch}
  checkout, branch, channels, user data, and playground deleted
  deletion is permanent; Git history remains in main/the remote merge
`)
}

function list() {
  const root = primaryRoot()
  const rows = parseWorktrees(root)
    .map((entry) => {
      const config = readConfig(entry.path)
      if (!config) return null
      if (entry.branch !== config.branch) {
        fail(`${entry.path} is on ${entry.branch ?? 'detached HEAD'}, expected ${config.branch}`)
      }
      return {
        slug: config.slug,
        branch: config.branch,
        port: config.port,
        merged: mergeStatus(root, config.branch).merged,
        path: entry.path,
      }
    })
    .filter(Boolean)

  if (rows.length === 0) {
    console.log('No managed worktrees.')
    return
  }
  for (const row of rows) {
    console.log(
      `${row.slug.padEnd(24)} ${String(row.port).padEnd(6)} ${row.merged ? 'merged ' : 'active '} ${row.path}`,
    )
  }
}

async function cleanup() {
  const root = primaryRoot()
  const merged = parseWorktrees(root)
    .map((entry) => readConfig(entry.path))
    .filter((config) => config && mergeStatus(root, config.branch).merged)
  if (merged.length === 0) {
    console.log('worktree ✓ no merged managed worktrees to clean')
    return
  }
  for (const config of merged) await remove(config.slug)
}

function help() {
  console.log(`Porcelain managed worktrees

Usage:
  pnpm worktree create <slug> [--skip-install]
  pnpm worktree list
  pnpm worktree remove <slug> [--force]
  pnpm worktree cleanup

create:
  Run from the primary main checkout. Creates work/<slug> in the sibling
  <repo>-worktrees/<slug> directory with an isolated port, channels, user data,
  and disposable playground. Installs dependencies unless --skip-install is set.

remove:
  Requires a clean worktree whose branch is merged into local main. Stops its
  recorded dev daemon, removes the checkout and branch, and permanently deletes
  its channels, user data, and playground. --force is only for abandoned work.

cleanup:
  Removes every clean managed worktree already merged into local main.
`)
}

async function main() {
  const [verb, name, ...rest] = process.argv.slice(2)
  if (!verb || verb === 'help' || verb === '--help' || verb === '-h') {
    help()
    return
  }
  if (verb === 'create') {
    create(name, { skipInstall: rest.includes('--skip-install') })
    return
  }
  if (verb === 'list') {
    list()
    return
  }
  if (verb === 'remove') {
    await remove(name, { force: rest.includes('--force') })
    return
  }
  if (verb === 'cleanup') {
    await cleanup()
    return
  }
  fail(`unknown command: ${verb}`)
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error))
})
