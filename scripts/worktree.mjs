#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const CONFIG_FILE = '.porcelain-worktree.json'
const INCLUDE_FILE = '.worktreeinclude'
const MAX_INCLUDED_FILES = 200
const BRANCH_PREFIX = 'work/'
const PORT_MIN = 43200
const PORT_MAX = 43999
/** Default integration base for managed worktrees. Omitted in older profiles ≡ this value. */
const DEFAULT_BASE = 'main'
/**
 * Local branch-like refs only. Rejects option-shaped names, path traversal, and
 * shell metacharacters so every git spawn keeps using argv + scrubbed ENV.
 */
const BASE_REF_PATTERN = /^(?:refs\/heads\/)?[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/

/**
 * Git's repository-local variables OVERRIDE `cwd`, and git exports them to every
 * hook it runs — so a script invoked from a hook inherits a pointer at the repo
 * being committed. This file always addresses a repository by `cwd`, and its
 * passes are destructive (cleanup prune, `worktree remove --force`, adopt
 * rollback), so cwd must stay authoritative. Same strip list and rationale as
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

/**
 * Normalize a local base branch/ref for storage. Does not talk to git — call
 * `resolveBaseRef` when the ref must exist in a concrete repository.
 */
function normalizeBaseRef(value, onError = fail) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (raw === '') return onError('base ref must be non-empty')
  if (raw.startsWith('-')) return onError('base ref must not look like a flag')
  if (raw.includes('..') || raw.includes('\\') || raw.includes('\0') || /\s/.test(raw)) {
    return onError('base ref is invalid')
  }
  if (!BASE_REF_PATTERN.test(raw)) {
    return onError('base ref must be a local branch-like name')
  }
  return raw.startsWith('refs/heads/') ? raw.slice('refs/heads/'.length) : raw
}

/**
 * Validate + resolve a base ref in `cwd`. Returns the normalized branch name
 * after `git rev-parse` confirms it points at a commit.
 */
function resolveBaseRef(cwd, value, onError = fail) {
  const base = normalizeBaseRef(value, onError)
  if (base === undefined) return undefined
  const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${base}^{commit}`], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: ENV,
  })
  if (result.status !== 0) return onError(`base ref does not resolve to a commit: ${base}`)
  return base
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
    const branch = `${BRANCH_PREFIX}${slug}`
    if (value.branch !== branch) return { ok: false, error: `branch must be ${branch}` }
    if (!Number.isInteger(value.port) || value.port < PORT_MIN || value.port > PORT_MAX) {
      return { ok: false, error: `port must be an integer in ${PORT_MIN}–${PORT_MAX}` }
    }
    let base = DEFAULT_BASE
    if (value.base !== undefined) {
      const errors = []
      base = normalizeBaseRef(value.base, (message) => {
        errors.push(message)
        return undefined
      })
      if (errors.length > 0 || base === undefined) {
        return { ok: false, error: errors[0] ?? 'base ref is invalid' }
      }
    }
    // Unknown fields are ignored so version-1 profiles stay forward-compatible.
    return {
      ok: true,
      config: { version: 1, slug, branch, port: value.port, base },
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Pure removal guard: whether a non-force remove may delete the worktree.
 * `reachableFromBase` is the result of `merge-base --is-ancestor branch base`.
 */
function planRemoveGuard({
  force = false,
  dirtyLines = [],
  reachableFromBase = false,
  base = DEFAULT_BASE,
}) {
  if (force) return { allow: true, reason: null }
  if (dirtyLines.length > 0) {
    return {
      allow: false,
      reason: `worktree has uncommitted changes:\n${dirtyLines.map((line) => `  ${line}`).join('\n')}`,
    }
  }
  if (!reachableFromBase) {
    return {
      allow: false,
      reason: `branch is not merged into local ${base}; integrate into ${base} first`,
    }
  }
  return { allow: true, reason: null }
}

/** Git argv for creating a managed worktree at `path` from `base`. */
function planCreateGitArgs({ branch, path, base = DEFAULT_BASE }) {
  return ['worktree', 'add', '-b', branch, path, base]
}

/** `--flag value` or `--flag=value`; undefined when absent, fails on an empty value. */
function flagValue(args, name) {
  const index = args.indexOf(`--${name}`)
  if (index !== -1) {
    const value = args[index + 1]
    if (value === undefined || value.startsWith('--')) fail(`--${name} needs a value`)
    return value
  }
  const inline = args.find((arg) => arg.startsWith(`--${name}=`))
  if (inline === undefined) return undefined
  const value = inline.slice(name.length + 3)
  if (value === '') fail(`--${name} needs a value`)
  return value
}

function managedPaths(slug) {
  return {
    home: join(homedir(), '.porcelain-dev-worktrees', slug),
    userData: join(homedir(), '.local', 'share', 'porcelain-dev-worktrees', slug),
    playground: join(homedir(), 'code', 'porcelain-playgrounds', slug),
  }
}

/** realpath when the directory still exists; the recorded path otherwise (prunable entries). */
function realPathOrSelf(path) {
  try {
    return realpathSync(path)
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

/**
 * `.worktreeinclude` lists gitignored files a fresh checkout needs (`.env`,
 * `.npmrc`, certs), applied at every entry point since Claude Code and
 * Codex only honor it partially on their own.
 * Subset of gitignore syntax: one relative path per line, `#`/blank lines
 * skipped, optional trailing `/`, `*` within one segment, no `**`, negation,
 * or anchoring — a directory pattern contributes the files beneath it.
 */
function segmentMatcher(segment) {
  const source = segment
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^/]*')
  return new RegExp(`^${source}$`)
}

function expandIncludePattern(root, pattern) {
  const segments = pattern
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.')
  if (segments.length === 0 || segments.includes('..') || pattern.includes('**')) return []

  let matches = ['']
  for (const segment of segments) {
    const next = []
    for (const prefix of matches) {
      const dir = join(root, prefix)
      if (!segment.includes('*')) {
        if (existsSync(join(dir, segment)))
          next.push(prefix === '' ? segment : `${prefix}/${segment}`)
        continue
      }
      const matcher = segmentMatcher(segment)
      let entries = []
      try {
        entries = readdirSync(dir)
      } catch {
        continue
      }
      for (const entry of entries) {
        if (matcher.test(entry)) next.push(prefix === '' ? entry : `${prefix}/${entry}`)
      }
    }
    matches = next
  }
  return matches
}

/** Files under `relPath` (itself, or its contents when it is a directory). Symlinks are skipped. */
function collectIncludeFiles(root, relPath, out) {
  if (out.size >= MAX_INCLUDED_FILES || relPath === '.git') return
  let stats
  try {
    stats = lstatSync(join(root, relPath))
  } catch {
    return
  }
  if (stats.isSymbolicLink()) return
  if (stats.isFile()) {
    out.add(relPath)
    return
  }
  if (!stats.isDirectory()) return
  let entries = []
  try {
    entries = readdirSync(join(root, relPath))
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry === '.git') continue
    collectIncludeFiles(root, `${relPath}/${entry}`, out)
  }
}

function isGitIgnored(root, relPath) {
  return (
    spawnSync('git', ['check-ignore', '-q', '--', relPath], {
      cwd: root,
      stdio: 'ignore',
      env: ENV,
    }).status === 0
  )
}

/**
 * Copy the primary checkout's `.worktreeinclude` files into a new worktree.
 * Only gitignored, existing, non-symlink files are copied, and an existing file
 * in the target is never overwritten — this seeds local secrets, it never
 * rewrites the checkout.
 */
function copyIncludedFiles(root, target) {
  const includePath = join(root, INCLUDE_FILE)
  if (!existsSync(includePath)) return
  let contents = ''
  try {
    contents = readFileSync(includePath, 'utf8')
  } catch {
    return
  }

  const candidates = new Set()
  for (const line of contents.split('\n')) {
    const pattern = line.trim()
    if (pattern === '' || pattern.startsWith('#')) continue
    for (const match of expandIncludePattern(root, pattern)) {
      collectIncludeFiles(root, match, candidates)
    }
  }
  if (candidates.size >= MAX_INCLUDED_FILES) {
    console.error(`worktree · ${INCLUDE_FILE} matched over ${MAX_INCLUDED_FILES} files; truncated`)
  }

  for (const relPath of [...candidates].sort()) {
    if (!isGitIgnored(root, relPath)) continue
    const destination = join(target, relPath)
    if (existsSync(destination)) continue
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(join(root, relPath), destination)
    console.log(`worktree · copied ${relPath}`)
  }
}

function installDependencies(path) {
  const result = spawnSync('pnpm', ['install', '--frozen-lockfile'], {
    cwd: path,
    stdio: 'inherit',
    env: ENV,
  })
  if (result.status !== 0) throw new Error(`dependency install failed in ${path}`)
}

function assertPrimaryCreate(root, force, base) {
  if (repoRoot() !== root) fail('create must run from the primary checkout, not a task worktree')
  // Default-main path keeps today's "create from main" rule so existing workflows
  // stay unchanged. Explicit non-main bases only require the primary checkout.
  if (base === DEFAULT_BASE) {
    const branch = git(root, ['branch', '--show-current'])
    if (branch !== 'main') fail(`create must run from main (currently ${branch || 'detached'})`)
  }
  const dirty = git(root, ['status', '--porcelain'])
  if (dirty !== '') {
    if (!force) {
      fail(
        'primary checkout is dirty; commit/integrate the current unit before creating a task worktree ' +
          `(or pass --force if the dirty files are a concurrent session's, not yours — \`git worktree ` +
          `add\` branches from the committed tip of ${base} regardless, so this only skips the safety check, ` +
          'not the checkout)',
      )
    }
    console.error(
      `worktree ⚠ primary checkout is dirty; --force set, branching from ${base}'s committed tip anyway. ` +
        'The uncommitted files stay in the primary checkout, untouched.',
    )
  }
}

function create(slugArg, options) {
  const slug = validateSlug(slugArg)
  const root = primaryRoot()
  const base = resolveBaseRef(root, options.base ?? DEFAULT_BASE)
  assertPrimaryCreate(root, options.force, base)

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
  git(root, planCreateGitArgs({ branch, path, base }), { inherit: true })

  try {
    writeConfig(path, { version: 1, slug, branch, port, base })
    copyIncludedFiles(root, path)
    createPlayground(paths.playground, slug)
    if (!options.skipInstall) installDependencies(path)
  } catch (error) {
    console.error('worktree · setup failed; rolling back the partial checkout')
    spawnSync('git', ['worktree', 'remove', '--force', path], {
      cwd: root,
      stdio: 'ignore',
      env: ENV,
    })
    spawnSync('git', ['branch', '-D', branch], { cwd: root, stdio: 'ignore', env: ENV })
    for (const target of Object.values(paths)) {
      if (existsSync(target)) rmSync(target, { recursive: true, force: true })
    }
    throw error
  }

  const integrateHint =
    base === DEFAULT_BASE
      ? `Push ${branch}, open a PR into main, then update main and run:\n  pnpm worktree remove ${slug}`
      : `Integrate ${branch} into ${base} (explicit review; no automatic merge), then run:\n  pnpm worktree remove ${slug}`

  console.log(`worktree ✓ created ${branch}

  checkout    ${path}
  base        ${base}
  port        ${port}
  channels    ${paths.home}
  user data   ${paths.userData}
  playground  ${paths.playground}

  cd ${path}
  pnpm build && pnpm dev:daemon -- --loopback
  pnpm porcelain review set ...

${integrateHint}
`)
}

function statusWithoutMetadata(path) {
  return git(path, ['status', '--porcelain', '--untracked-files=all'])
    .split('\n')
    .filter((line) => line !== '' && line.slice(3) !== CONFIG_FILE)
}

/** True when `commitish` is an ancestor of `base` (branch tip reachable from base). */
function isAncestorOf(root, commitish, base) {
  return (
    spawnSync('git', ['merge-base', '--is-ancestor', commitish, base], {
      cwd: root,
      stdio: 'ignore',
      env: ENV,
    }).status === 0
  )
}

/** Harness cleanup still keys off main — those checkouts are not managed profiles. */
function isAncestorMerged(root, branch) {
  return isAncestorOf(root, branch, DEFAULT_BASE)
}

/** Porcelain status of a worktree, or null when the directory is gone/unreadable. */
function statusOrNull(path) {
  if (!existsSync(path)) return null
  const result = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd: path,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: ENV,
  })
  if (result.status !== 0) return null
  return (result.stdout ?? '').trim()
}

/**
 * Directories a harness creates worktrees in. Keep in sync with
 * `is_harness_worktree` in .husky/pre-commit — same allowlist, same order.
 */
function isHarnessPath(path) {
  const home = homedir()
  return (
    path.startsWith(join(home, '.t3', 'worktrees') + sep) ||
    path.startsWith(join(home, '.codex', 'worktrees') + sep) ||
    path.startsWith(join(home, '.grok', 'worktrees') + sep) ||
    path.includes(`${sep}.claude${sep}worktrees${sep}`)
  )
}

/**
 * Linked worktrees this script doesn't manage — Codex, Grok Build, or a
 * hand-made checkout — clutter `git worktree list`; no harness removes them.
 * `prunable` requires DETACHED, clean, already-merged, AND under a
 * recognized harness root. Anything on a branch, dirty, or with unreachable
 * commits is reported but never touched — likewise for checkouts outside
 * those roots, since `git status` can't see gitignored files.
 */
function harnessWorktrees(root) {
  return parseWorktrees(root)
    .filter(
      (entry) =>
        entry.path !== root &&
        entry.branch === null &&
        entry.detached &&
        !existsSync(join(entry.path, CONFIG_FILE)),
    )
    .map((entry) => {
      const status = statusOrNull(entry.path)
      const clean = status === ''
      const harnessPath = isHarnessPath(entry.path)
      return {
        path: entry.path,
        head: entry.head,
        clean,
        harnessPath,
        prunable:
          harnessPath &&
          clean &&
          typeof entry.head === 'string' &&
          isAncestorMerged(root, entry.head),
      }
    })
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
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: ENV },
  )
  if (result.status !== 0) return null
  try {
    const rows = JSON.parse(result.stdout)
    return rows[0] ?? null
  } catch {
    return null
  }
}

function mergeStatus(root, branch, base = DEFAULT_BASE) {
  if (isAncestorOf(root, branch, base)) return { merged: true, kind: 'ancestor', pr: null }
  // GitHub PR discovery stays main-only; non-main bases use ancestry only.
  if (base === DEFAULT_BASE) {
    const pr = mergedPullRequest(root, branch)
    const branchTip = git(root, ['rev-parse', branch])
    return pr?.headRefOid === branchTip
      ? { merged: true, kind: 'pull-request', pr }
      : { merged: false, kind: null, pr: null }
  }
  return { merged: false, kind: null, pr: null }
}

function assertLocalMainContainsOrigin(root) {
  git(root, ['fetch', 'origin', 'main', '--quiet'])
  const current = spawnSync('git', ['merge-base', '--is-ancestor', 'origin/main', 'main'], {
    cwd: root,
    stdio: 'ignore',
    env: ENV,
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
    env: ENV,
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
  const { slug, branch, base } = worktree.config
  const paths = managedPaths(slug)

  if (!options.force) {
    const dirty = statusWithoutMetadata(worktree.path)
    const merge = mergeStatus(root, branch, base)
    const guard = planRemoveGuard({
      force: false,
      dirtyLines: dirty,
      reachableFromBase: merge.merged,
      base,
    })
    if (!guard.allow) fail(guard.reason)
    if (merge.kind === 'pull-request') assertLocalMainContainsOrigin(root)
  }

  await stopDaemon(worktree.path, paths.home)
  git(root, ['worktree', 'remove', ...(options.force ? ['--force'] : []), worktree.path])
  const ancestryMerged = isAncestorOf(root, branch, base)
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

function readCanvasList(root, worktreePath) {
  const cli = join(root, 'apps', 'desktop', 'out', 'main', 'cli', 'porcelain.js')
  const result = spawnSync(process.execPath, [cli, 'canvas', 'list', '--repo', worktreePath], {
    cwd: worktreePath,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    env: ENV,
  })
  return result.status === 0 ? result.stdout.trim() : ''
}

function prBody(root, branch, worktreePath) {
  const commits = git(root, ['log', `main..${branch}`, '--oneline'])
  const commitSection = ['## Commits', '', '```', commits, '```', ''].join('\n')
  const canvases = readCanvasList(root, worktreePath)
  if (canvases === '') {
    return [
      `_No daemon-root Canvas found for \`${worktreePath}\`._`,
      '',
      'Publish one with `pnpm porcelain review set` / `porcelain canvas set`.',
      '',
      commitSection,
    ].join('\n')
  }
  return `## Review Canvas\n\n${canvases}\n\n${commitSection}`
}

function requireGh(root) {
  const result = spawnSync('gh', ['--version'], { cwd: root, stdio: 'ignore', env: ENV })
  if (result.error || result.status !== 0) {
    fail('the GitHub CLI (gh) is required for this command; install it and run `gh auth login`')
  }
}

function openPullRequest(root, branch) {
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
      'open',
      '--limit',
      '1',
      '--json',
      'url',
    ],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: ENV },
  )
  if (result.status !== 0) return null
  try {
    const url = JSON.parse(result.stdout)[0]?.url
    return typeof url === 'string' && url !== '' ? url : null
  } catch {
    return null
  }
}

function pullRequest(slugArg, options) {
  const root = primaryRoot()
  const worktree = findManaged(root, slugArg)
  const { branch } = worktree.config
  if (git(root, ['rev-list', '--count', `main..${branch}`]) === '0') {
    fail(`${branch} has no commits ahead of main; commit the unit before opening a PR`)
  }

  if (options.dryRun) {
    console.log(`title: ${options.title ?? git(root, ['log', '-1', '--format=%s', branch])}\n`)
    console.log(prBody(root, branch, worktree.path))
    return
  }

  requireGh(root)
  const existing = openPullRequest(root, branch)
  if (existing) {
    console.log(`worktree ✓ pull request already open for ${branch}\n  ${existing}\n`)
    return
  }

  git(root, ['push', '-u', 'origin', branch], { inherit: true })

  const title = options.title ?? git(root, ['log', '-1', '--format=%s', branch])
  const body = prBody(root, branch, worktree.path)
  const dir = mkdtempSync(join(tmpdir(), 'porcelain-pr-'))
  const bodyFile = join(dir, 'body.md')
  try {
    writeFileSync(bodyFile, `${body}\n`)
    const args = [
      'pr',
      'create',
      '--head',
      branch,
      '--base',
      'main',
      '--title',
      title,
      '--body-file',
      bodyFile,
    ]
    if (options.draft) args.push('--draft')
    const created = checked(root, 'gh', args)
    console.log(`worktree ✓ opened ${options.draft ? 'draft ' : ''}pull request for ${branch}
  ${created.split('\n').filter(Boolean).pop() ?? ''}
`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function adopt(pathArg, slugArg, options) {
  if (!pathArg) fail('adopt needs the harness worktree path')
  const root = primaryRoot()
  const target = realPathOrSelf(resolve(pathArg))
  const slug = validateSlug(slugArg)
  const branch = `${BRANCH_PREFIX}${slug}`
  const paths = managedPaths(slug)

  if (target === root) fail('refusing to adopt the primary checkout')
  const entry = parseWorktrees(root).find((worktree) => worktree.path === target)
  if (!entry) fail(`not a linked worktree of this repository: ${target}`)
  if (entry.branch !== null) {
    fail(`${target} is already on ${entry.branch}; adopt only converts a detached worktree`)
  }
  if (typeof entry.head !== 'string' || entry.head === '') {
    fail(`${target} has no resolvable HEAD commit`)
  }
  if (existsSync(join(target, CONFIG_FILE))) fail(`${target} is already a managed worktree`)
  if (git(root, ['branch', '--list', branch]) !== '') fail(`branch already exists: ${branch}`)
  for (const runtime of Object.values(paths)) {
    if (existsSync(runtime)) fail(`managed runtime path already exists: ${runtime}`)
  }

  const port = allocatePort(root)
  git(target, ['switch', '-c', branch])

  try {
    // Adopted harness checkouts still integrate via main unless a later tool rewrites base.
    writeConfig(target, { version: 1, slug, branch, port, base: DEFAULT_BASE })
    copyIncludedFiles(root, target)
    createPlayground(paths.playground, slug)
    if (!options.skipInstall) installDependencies(target)
  } catch (error) {
    console.error('worktree · adoption failed; restoring the detached checkout')
    spawnSync('git', ['switch', '--detach', entry.head], {
      cwd: target,
      stdio: 'ignore',
      env: ENV,
    })
    spawnSync('git', ['branch', '-D', branch], { cwd: root, stdio: 'ignore', env: ENV })
    rmSync(join(target, CONFIG_FILE), { force: true })
    for (const runtime of Object.values(paths)) {
      if (existsSync(runtime)) rmSync(runtime, { recursive: true, force: true })
    }
    throw error
  }

  console.log(`worktree ✓ adopted ${branch}

  checkout    ${target}  (adopted in place — not moved)
  port        ${port}
  channels    ${paths.home}
  user data   ${paths.userData}
  playground  ${paths.playground}

  cd ${target}
  pnpm build && pnpm dev:daemon -- --loopback

The checkout stays where its harness created it; \`pnpm worktree remove ${slug}\`
deletes that directory along with the branch and managed runtime state.
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
        base: config.base,
        merged: mergeStatus(root, config.branch, config.base).merged,
        path: entry.path,
      }
    })
    .filter(Boolean)

  if (rows.length === 0) {
    console.log('No managed worktrees.')
  }
  for (const row of rows) {
    const baseLabel = row.base === DEFAULT_BASE ? '' : ` base=${row.base}`
    console.log(
      `${row.slug.padEnd(24)} ${String(row.port).padEnd(6)} ${row.merged ? 'merged ' : 'active '}${baseLabel} ${row.path}`,
    )
  }

  const harness = harnessWorktrees(root)
  if (harness.length === 0) return
  console.log('\nunmanaged (harness) worktrees:')
  for (const entry of harness) {
    const head = typeof entry.head === 'string' ? entry.head.slice(0, 8) : 'unknown'
    const state = entry.clean ? 'clean ' : 'dirty '
    const disposition = entry.prunable
      ? 'prunable'
      : entry.harnessPath
        ? 'keep    '
        : 'keep (not a harness path)'
    console.log(`  detached@${head} ${state} ${disposition} ${entry.path}`)
  }
  console.log(
    '  `pnpm worktree cleanup` removes the prunable ones; `pnpm worktree adopt <path> <slug>` keeps one.',
  )
}

/** Second cleanup pass: detached, clean, already-merged checkouts under a harness root. */
function pruneHarnessWorktrees(root) {
  const prunable = harnessWorktrees(root).filter((entry) => entry.prunable)
  if (prunable.length === 0) return
  for (const entry of prunable) {
    git(root, ['worktree', 'remove', entry.path])
    console.log(`worktree ✓ pruned harness checkout ${entry.path}`)
  }
  console.log(`worktree ✓ pruned ${prunable.length} unmanaged detached checkout(s)`)
}

async function cleanup() {
  const root = primaryRoot()
  const merged = parseWorktrees(root)
    .map((entry) => readConfig(entry.path))
    .filter((config) => config && mergeStatus(root, config.branch, config.base).merged)
  if (merged.length === 0) {
    console.log('worktree ✓ no merged managed worktrees to clean')
  }
  for (const config of merged) await remove(config.slug)
  pruneHarnessWorktrees(root)
}

function help() {
  console.log(
    `Porcelain managed worktrees

Usage:
  pnpm worktree create <slug> [--base <ref>] [--skip-install] [--force]
  pnpm worktree adopt <path> <slug> [--skip-install]
  pnpm worktree list
  pnpm worktree pr <slug> [--draft] [--dry-run] [--title <title>]
  pnpm worktree remove <slug> [--force]
  pnpm worktree cleanup

create:
  Run from the primary checkout. Creates work/<slug> in the sibling
  <repo>-worktrees/<slug> directory with an isolated port, channels, user data,
  and disposable playground. Installs dependencies unless --skip-install is set.
  Default base is main (create must run from main in that case). Pass --base <ref>
  to branch from another local branch/ref; the normalized base is stored in
  .porcelain-worktree.json. Refuses a dirty primary checkout by default — the
  branch point is the base's last COMMIT either way, so this check only guards
  against silently losing your own uncommitted work. When the dirty files are
  provably not yours, pass --force to skip the check; it does not touch or stage
  those files.

adopt:
  Converts a detached harness worktree (Codex, Grok Build, hand-made) into a
  managed one: branches work/<slug> at its current HEAD, writes the managed
  config (base=main), allocates a port, and creates the playground. The checkout
  stays where the harness put it; remove <slug> later deletes that directory.

.worktreeinclude:
  create and adopt both copy the gitignored files this file lists (one relative
  path per line, \` * \` within a segment) from the primary checkout into the new
  worktree, never overwriting an existing file. Agent harnesses apply that file
  inconsistently; this script is the one mechanism.

list:
  Managed worktrees first, then any unmanaged detached checkouts a harness left
  behind, marked prunable when they sit under a harness root (~/.t3, ~/.codex,
  ~/.grok, */.claude/worktrees) and are clean and already merged into their
  recorded base (main for harness pruning).

pr:
  Pushes work/<slug> to origin and opens a PR into main via gh (main-only). Title
  defaults to the branch's latest commit subject; the body carries the worktree's
  published Review (Intent + Evidence) when one exists, plus the commit list.
  Evidence-pack screenshots are published to R2 and inlined as short-lived (~2h)
  presigned links so they render on GitHub. Prints the URL and exits when a PR is
  already open for the branch. --dry-run prints the title and body it would send,
  lists screenshot names it would upload, and touches neither origin, gh, nor R2.

remove:
  Requires a clean worktree whose branch tip is reachable from its recorded base
  (default main for older profiles). Stops its recorded dev daemon, removes the
  checkout and branch, and permanently deletes its channels, user data, and
  playground. --force is only for abandoned work.

cleanup:
  Removes every clean managed worktree already merged into its recorded base,
  then prunes unmanaged detached harness checkouts that are clean and whose HEAD
  is reachable from main. Never touches a worktree on a branch, a dirty one, one
  holding commits its base does not have, or a hand-made checkout outside a
  harness root.
`,
  )
}

async function main() {
  const [verb, name, ...rest] = process.argv.slice(2)
  if (!verb || verb === 'help' || verb === '--help' || verb === '-h') {
    help()
    return
  }
  if (verb === 'create') {
    create(name, {
      skipInstall: rest.includes('--skip-install'),
      force: rest.includes('--force'),
      base: flagValue(rest, 'base'),
    })
    return
  }
  if (verb === 'adopt') {
    const positional = rest.filter((arg) => !arg.startsWith('--'))
    adopt(name, positional[0], { skipInstall: rest.includes('--skip-install') })
    return
  }
  if (verb === 'list') {
    list()
    return
  }
  if (verb === 'pr') {
    pullRequest(name, {
      draft: rest.includes('--draft'),
      dryRun: rest.includes('--dry-run'),
      title: flagValue(rest, 'title'),
    })
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

/**
 * Load `.porcelain-worktree.json` without process.exit — for dispatch adoption.
 * @param {string} worktreePath
 * @returns {{ ok: true, config: { version: 1, slug: string, branch: string, port: number, base: string } } | { ok: false, error: string }}
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
    target = realpathSync(worktreePath)
  } catch {
    return false
  }
  return parseWorktrees(root).some((entry) => entry.path === target)
}

export {
  BASE_REF_PATTERN,
  CONFIG_FILE,
  DEFAULT_BASE,
  ENV,
  isLinkedWorktreeOf,
  loadManagedWorktreeProfile,
  normalizeBaseRef,
  parseWorktreeConfig,
  parseWorktrees,
  planCreateGitArgs,
  planRemoveGuard,
  resolveBaseRef,
  validateSlug,
}

const isDirectRun =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isDirectRun) {
  main().catch((error) => {
    fail(error instanceof Error ? error.message : String(error))
  })
}
