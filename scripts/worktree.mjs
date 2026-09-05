#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
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
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { windowsProcessIdentity } from './windows-process.mjs'

const CONFIG_FILE = '.porcelain-worktree.json'
const PORT_MIN = 43200
const PORT_MAX = 43999

/**
 * Git's repository-local variables OVERRIDE `cwd`, and git exports them to every
 * hook it runs — so a script invoked from a hook inherits a pointer at the repo
 * being committed. This file always addresses a repository by `cwd`, and its
 * runtime cleanup removes profile data, so cwd must stay authoritative. Same strip list as
 * `apps/daemon/src/git/git-env.ts` (mirrors `git rev-parse --local-env-vars`); other
 * `GIT_*` vars are the user's real config and pass through. Used for EVERY child
 * spawn here, git or not.
 */
const REPO_LOCAL_ENV = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CONFIG',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  'GIT_OBJECT_DIRECTORY',
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_GRAFT_FILE',
  'GIT_INDEX_FILE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_REPLACE_REF_BASE',
  'GIT_PREFIX',
  'GIT_SHALLOW_FILE',
  'GIT_COMMON_DIR',
]

const ENV = (() => {
  const env = { ...process.env }
  for (const key of REPO_LOCAL_ENV) delete env[key]
  return env
})()

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
      env: ENV,
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
    env: ENV,
  })
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `${command} ${args.join(' ')} failed`)
  }
  return result.stdout?.trim() ?? ''
}

function repoRoot(cwd = process.cwd()) {
  return realpathSync.native(git(cwd, ['rev-parse', '--show-toplevel']))
}

function primaryRoot(cwd = process.cwd()) {
  const common = git(cwd, ['rev-parse', '--git-common-dir'])
  const commonPath = realpathSync.native(resolve(repoRoot(cwd), common))
  return realpathSync.native(dirname(commonPath))
}

function validateSlug(value) {
  const slug = value?.trim()
  if (!slug || !/^[a-z0-9][a-z0-9-]{1,47}$/.test(slug)) {
    fail('slug must be 2–48 lowercase letters, numbers, or hyphens')
  }
  return slug
}

/** Stable managed slug for a Codex harness path such as `~/.codex/worktrees/1b28/repo`. */
function codexSlugForPath(worktreePath) {
  const harnessId = basename(dirname(resolve(worktreePath)))
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '')
  return validateSlug(`codex-${harnessId}`)
}

/**
 * Pure config parse for tests and callers that need the structured result without
 * process.exit. Returns `{ ok: true, config }` or `{ ok: false, error }`.
 */
function parseWorktreeConfig(value) {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, error: 'config must be a JSON object' }
    }
    if (value.version !== 1) return { ok: false, error: 'version must be 1' }
    const slug = typeof value.slug === 'string' ? value.slug.trim() : ''
    if (!slug || !/^[a-z0-9][a-z0-9-]{1,47}$/.test(slug)) {
      return { ok: false, error: 'slug must be 2–48 lowercase letters, numbers, or hyphens' }
    }
    if (!Number.isInteger(value.port) || value.port < PORT_MIN || value.port > PORT_MAX) {
      return { ok: false, error: `port must be an integer in ${PORT_MIN}–${PORT_MAX}` }
    }
    // Unknown fields are ignored so version-1 profiles stay forward-compatible.
    return {
      ok: true,
      config: { version: 1, slug, port: value.port },
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function managedPaths(slug) {
  return {
    home: join(homedir(), '.porcelain-dev-worktrees', slug),
    userData: join(homedir(), '.local', 'share', 'porcelain-dev-worktrees', slug),
    playground: join(homedir(), 'code', 'porcelain-playgrounds', slug),
  }
}

/** Native resolution expands Windows 8.3 aliases; retain recorded paths for prunable entries. */
function realPathOrSelf(path) {
  try {
    return realpathSync.native(path)
  } catch {
    return path
  }
}

function parseWorktrees(root) {
  return git(root, ['worktree', 'list', '--porcelain'])
    .split('\n\n')
    .map((block) => {
      const lines = block.split('\n')
      const path = lines.find((line) => line.startsWith('worktree '))?.slice(9)
      const branch = lines.find((line) => line.startsWith('branch refs/heads/'))?.slice(18)
      const head = lines.find((line) => line.startsWith('HEAD '))?.slice(5)
      return path
        ? {
            path: realPathOrSelf(path),
            branch: branch ?? null,
            head: head ?? null,
            detached: lines.includes('detached'),
          }
        : null
    })
    .filter(Boolean)
}

function readConfig(worktreePath) {
  const path = join(worktreePath, CONFIG_FILE)
  if (!existsSync(path)) return null
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'))
    const parsed = parseWorktreeConfig(value)
    if (!parsed.ok) {
      fail(`${path} is invalid (${parsed.error}); remove and recreate this managed worktree`)
    }
    // Side-effect: validateSlug rejects the same way as other call sites when the
    // profile is present but the slug shape is wrong (already covered by parse).
    validateSlug(parsed.config.slug)
    return parsed.config
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

/**
 * Serialize the brief interval between inspecting managed profiles and writing a
 * new profile. Git worktrees make the allocation visible only after the config
 * is written, so an in-process Set alone cannot protect simultaneous Codex
 * setup commands. An exclusive loopback listener provides a process-owned lock:
 * the OS releases it on exit, including crashes. Hash collisions only serialize
 * unrelated checkouts; they cannot allow simultaneous allocation.
 */
export async function withAllocationLock(root, action) {
  const common = realpathSync.native(resolve(root, git(root, ['rev-parse', '--git-common-dir'])))
  const key = process.platform === 'win32' ? common.toLowerCase() : common
  const port = 45000 + (createHash('sha256').update(key).digest().readUInt16BE(0) % 1000)
  const deadline = Date.now() + 30_000
  while (true) {
    const server = createServer((socket) => socket.destroy())
    try {
      await new Promise((accept, reject) => {
        server.once('error', reject)
        server.listen({ host: '127.0.0.1', port, exclusive: true }, accept)
      })
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error
      if (Date.now() >= deadline)
        throw new Error(`Timed out waiting for allocation on port ${port}`)
      await delay(25)
      continue
    }
    try {
      return await action()
    } finally {
      await new Promise((accept, reject) =>
        server.close((error) => (error ? reject(error) : accept())),
      )
    }
  }
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
      realpathSync.native(value.worktreeRoot) !== realpathSync.native(worktreePath)
    ) {
      return null
    }
    return { pid: value.pid, path, started: value.started }
  } catch {
    return null
  }
}

function processIsManagedDaemon(pid, worktreePath, started) {
  try {
    process.kill(pid, 0)
  } catch {
    return false
  }

  if (process.platform === 'win32') {
    const identity = windowsProcessIdentity(pid)
    if (!identity) return false
    if (!started || identity.started !== started) {
      fail('Cannot establish ownership of the recorded Windows daemon; stop it before cleanup')
    }
    return /scripts[\\/]dev-daemon\.mjs(?:["\s]|$)/.test(identity.command ?? '')
  }

  if (process.platform === 'linux') {
    try {
      const cwd = realpathSync.native(readlinkSync(`/proc/${pid}/cwd`))
      const command = readFileSync(`/proc/${pid}/cmdline`, 'utf8').replaceAll('\0', ' ')
      return cwd === realpathSync.native(worktreePath) && command.includes('scripts/dev-daemon.mjs')
    } catch {
      return false
    }
  }

  const command = spawnSync('ps', ['-p', String(pid), '-o', 'command='], {
    encoding: 'utf8',
    env: ENV,
  }).stdout
  return (
    (command ?? '').includes('scripts/dev-daemon.mjs') && (command ?? '').includes(worktreePath)
  )
}

async function stopDaemon(worktreePath, home) {
  const record = recordedDaemon(worktreePath, home)
  if (!record) return
  if (!processIsManagedDaemon(record.pid, worktreePath, record.started)) {
    rmSync(record.path, { force: true })
    return
  }
  if (process.platform === 'win32') {
    execFileSync('taskkill.exe', ['/PID', String(record.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'pipe',
      timeout: 15000,
    })
  } else process.kill(record.pid, 'SIGTERM')
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
  return { ...match, config }
}

/** Give a Codex checkout an isolated runtime profile without changing its Git state. */
function bootstrapCodexWorktree(pathArg) {
  const target = realPathOrSelf(resolve(pathArg || process.cwd()))
  const root = primaryRoot(target)
  if (target === root) {
    console.log('worktree ✓ Codex setup is using the primary checkout')
    return
  }

  const entry = parseWorktrees(root).find((worktree) => worktree.path === target)
  if (!entry) fail(`not a linked worktree of this repository: ${target}`)

  return withAllocationLock(root, () => {
    // Another setup process may have completed while this checkout waited.
    const profile = loadManagedWorktreeProfile(target)
    if (!profile.ok && existsSync(join(target, CONFIG_FILE))) fail(profile.error)
    if (profile.ok) {
      console.log(`worktree ✓ Codex checkout already uses isolated profile ${profile.config.slug}`)
      return
    }

    const slug = target.includes(`${sep}.codex${sep}worktrees${sep}`)
      ? codexSlugForPath(target)
      : `checkout-${createHash('sha256').update(target).digest('hex').slice(0, 12)}`
    const paths = managedPaths(slug)
    for (const runtime of Object.values(paths)) {
      if (existsSync(runtime)) fail(`managed runtime path already exists: ${runtime}`)
    }
    const port = allocatePort(root)
    try {
      writeConfig(target, { version: 1, slug, port })
      createPlayground(paths.playground, slug)
    } catch (error) {
      rmSync(join(target, CONFIG_FILE), { force: true })
      for (const runtime of Object.values(paths)) {
        if (existsSync(runtime)) rmSync(runtime, { recursive: true, force: true })
      }
      throw error
    }
    console.log(`worktree ✓ isolated Codex checkout ${slug}

  checkout    ${target}  (${entry.branch ?? 'detached HEAD'} preserved)
  port        ${port}
  channels    ${paths.home}
  user data   ${paths.userData}
  playground  ${paths.playground}
`)
  })
}

/** Release Porcelain resources; Codex owns deletion of its checkout and Git state. */
async function cleanupCodexWorktree(pathArg) {
  const target = realPathOrSelf(resolve(pathArg || process.cwd()))
  const profile = loadManagedWorktreeProfile(target)
  if (!profile.ok && existsSync(join(target, CONFIG_FILE))) fail(profile.error)
  if (!profile.ok) {
    console.log('worktree ✓ Codex checkout has no managed Porcelain profile')
    return
  }
  const root = primaryRoot(target)
  const managed = findManaged(root, profile.config.slug)
  if (managed.path !== target) {
    fail(`managed slug ${profile.config.slug} belongs to ${managed.path}, not ${target}`)
  }
  const paths = managedPaths(profile.config.slug)
  safeManagedTarget(paths.home, join(homedir(), '.porcelain-dev-worktrees'))
  safeManagedTarget(paths.userData, join(homedir(), '.local', 'share', 'porcelain-dev-worktrees'))
  safeManagedTarget(paths.playground, join(homedir(), 'code', 'porcelain-playgrounds'))
  await stopDaemon(target, paths.home)
  for (const path of Object.values(paths)) rmSync(path, { recursive: true, force: true })
  rmSync(join(target, CONFIG_FILE), { force: true })
  console.log(
    'worktree ✓ Porcelain development resources removed; checkout and Git state preserved',
  )
}

function list() {
  for (const entry of parseWorktrees(primaryRoot())) {
    const config = readConfig(entry.path)
    if (config) console.log([config.slug, config.port, entry.path].join('  '))
  }
}

function help() {
  console.log(`Porcelain development profiles

Usage:
  pnpm worktree setup [checkout-path]
  pnpm worktree cleanup [checkout-path]
  pnpm worktree list

Create checkouts with Git or your coding harness, then run setup to allocate
isolated ports, development data, and a playground. Cleanup removes only those
Porcelain resources. Branches, commits, and checkout files remain untouched.
Codex environment hooks select CODEX_WORKTREE_PATH automatically.`)
}

async function main() {
  const [verb, path, ...rest] = process.argv.slice(2)
  if (rest.length) fail('Unexpected arguments; use --help')
  if (!verb || ['help', '--help', '-h'].includes(verb)) return help()
  if (verb === 'setup' || verb === 'codex-bootstrap') {
    return bootstrapCodexWorktree(
      path || (verb === 'codex-bootstrap' ? process.env.CODEX_WORKTREE_PATH : undefined),
    )
  }
  if (verb === 'cleanup' || verb === 'codex-cleanup') {
    return cleanupCodexWorktree(
      path || (verb === 'codex-cleanup' ? process.env.CODEX_WORKTREE_PATH : undefined),
    )
  }
  if (verb === 'list' && !path) return list()
  fail(`unknown command: ${verb}; use --help`)
}

/**
 * Load `.porcelain-worktree.json` without process.exit — for dispatch adoption.
 * @param {string} worktreePath
 * @returns {{ ok: true, config: { version: 1, slug: string, port: number } } | { ok: false, error: string }}
 */
function loadManagedWorktreeProfile(worktreePath) {
  const path = join(worktreePath, CONFIG_FILE)
  if (!existsSync(path)) return { ok: false, error: `missing ${CONFIG_FILE}` }
  let value
  try {
    value = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    return {
      ok: false,
      error: `unreadable ${CONFIG_FILE}: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
  return parseWorktreeConfig(value)
}

/**
 * Whether `worktreePath` is a linked worktree of the repository rooted at `root`.
 * @param {string} root
 * @param {string} worktreePath
 */
function isLinkedWorktreeOf(root, worktreePath) {
  let target
  try {
    target = realpathSync.native(worktreePath)
  } catch {
    return false
  }
  return parseWorktrees(root).some((entry) => entry.path === target)
}

export {
  CONFIG_FILE,
  codexSlugForPath,
  ENV,
  isLinkedWorktreeOf,
  loadManagedWorktreeProfile,
  parseWorktreeConfig,
  parseWorktrees,
  validateSlug,
}

const isDirectRun =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isDirectRun) {
  main().catch((error) => {
    fail(error instanceof Error ? error.message : String(error))
  })
}
