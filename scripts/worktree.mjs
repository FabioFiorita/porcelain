#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
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

const CONFIG_FILE = '.porcelain-worktree.json'
const INCLUDE_FILE = '.worktreeinclude'
const MAX_INCLUDED_FILES = 200
const BRANCH_PREFIX = 'work/'
const PORT_MIN = 43200
const PORT_MAX = 43999

/**
 * Git's repository-local variables OVERRIDE `cwd`, and git exports them to every
 * hook it runs — so a script invoked from a hook inherits a pointer at the repo
 * being committed. This file always addresses a repository by `cwd`, and its
 * passes are destructive (cleanup prune, `worktree remove --force`, adopt
 * rollback), so cwd must stay authoritative. Same strip list and rationale as
 * `src/backend/git-env.ts` (mirrors `git rev-parse --local-env-vars`); other
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

/**
 * `.worktreeinclude` — the gitignored files a fresh checkout needs (`.env`,
 * `.npmrc`, local certs). Claude Code skips this file entirely once a
 * WorktreeCreate hook is configured, and Codex only honours it for worktrees it
 * manages itself, so this script applies it for EVERY entry point (create and
 * adopt) and stays the one mechanism.
 *
 * Deliberate pattern SUBSET (not gitignore semantics): one relative path per
 * line, `#` comments and blank lines skipped, an optional trailing `/`, and `*`
 * matching within a single path segment. No `**`, no negation, no anchoring
 * rules — an unsupported form simply matches nothing. A pattern that lands on a
 * directory contributes the files beneath it.
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
      env: ENV,
    }).status === 0
  )
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
 * `is_harness_worktree` in githooks/pre-commit — same allowlist, same order.
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
 * Linked worktrees this script does not manage — Codex (`~/.codex/worktrees/…`),
 * Grok Build (`~/.grok/worktrees/…`), or a hand-made detached checkout. They
 * register in `git worktree list` for this repo and clutter the switcher, and no
 * harness reliably removes them.
 *
 * Only a DETACHED, clean, already-merged entry UNDER a recognized harness root is
 * `prunable`. Anything on a branch, dirty, or carrying unreachable commits is
 * reported but never touched — and neither is a hand-made checkout outside those
 * roots: `git status` cannot see gitignored files, so "clean" does not prove
 * "worthless" for a directory a human made deliberately.
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

function readJsonFile(path) {
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'))
    return value !== null && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/**
 * Keys a published Review could be filed under. The porcelain CLI keys channels by
 * `git rev-parse --show-toplevel` from the session cwd, which may or may not be the
 * realpath we get from `git worktree list`; try both.
 */
function channelKeys(worktreePath) {
  const keys = new Set([worktreePath])
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: worktreePath,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    env: ENV,
  })
  const top = (result.stdout ?? '').trim()
  if (result.status === 0 && top !== '') keys.add(top)
  return [...keys]
}

/** The worktree's review set from its isolated channel home (see src/backend/review-store.ts). */
function readReviewSet(home, keys) {
  const all = readJsonFile(join(home, 'review-sets.json'))
  if (!all) return null
  for (const key of keys) {
    const set = all[key]
    if (set !== null && typeof set === 'object') return set
  }
  return null
}

/** The worktree's loop evidence pack (see src/backend/evidence-paths.ts for the keying). */
function readEvidence(home, keys) {
  for (const key of keys) {
    const dir = join(
      home,
      'loop-evidence',
      createHash('sha256').update(key).digest('hex').slice(0, 16),
    )
    if (!existsSync(join(dir, 'index.html'))) continue
    const meta = readJsonFile(join(dir, 'meta.json')) ?? {}
    return {
      dir,
      title: text(meta.title, 120) || 'Evidence',
      updatedAt: text(meta.updatedAt, 64),
      checks: Array.isArray(meta.checks) ? meta.checks.slice(0, 40) : [],
    }
  }
  return null
}

const CHECK_MARKS = { pass: '✓', fail: '✗', skip: '–' }

function renderReviewBody(review, evidence) {
  const lines = []
  if (review) {
    const thesis = text(review.thesis, 4000)
    lines.push('## Intent', '', thesis || `_${text(review.name, 120) || 'Feature view'}_`, '')
    const sections = Array.isArray(review.sections) ? review.sections.slice(0, 30) : []
    if (sections.length > 0) {
      lines.push('Walkthrough:', '')
      for (const section of sections) {
        const title = text(section?.title, 200)
        if (title !== '') lines.push(`- **${title}**`)
      }
      lines.push('')
    }
    const files = Array.isArray(review.files) ? review.files : []
    if (files.length > 0) {
      lines.push(`Execution: ${files.length} file(s) in the Review.`, '')
    }
  }
  if (evidence) {
    const when = evidence.updatedAt === '' ? '' : ` · updated ${evidence.updatedAt}`
    lines.push('## Evidence', '', `**${evidence.title}**${when}`, '')
    for (const check of evidence.checks) {
      const label = text(check?.label, 200)
      if (label === '') continue
      const mark = CHECK_MARKS[check?.status] ?? '·'
      const detail = text(check?.detail, 400)
      lines.push(`- ${mark} ${label}${detail === '' ? '' : ` — \`${detail}\``}`)
    }
    lines.push('', `Pack: \`${join(evidence.dir, 'index.html')}\``, '')
  }
  return lines.join('\n')
}

function prBody(root, branch, worktreePath, home) {
  const keys = channelKeys(worktreePath)
  const review = readReviewSet(home, keys)
  const evidence = readEvidence(home, keys)
  const commits = git(root, ['log', `main..${branch}`, '--oneline'])
  const commitSection = ['## Commits', '', '```', commits, '```', ''].join('\n')
  if (!review && !evidence) {
    return [
      `_No published Review found for \`${worktreePath}\`._`,
      '',
      'Publish one with `pnpm porcelain review set` / `porcelain evidence prepare`.',
      '',
      commitSection,
    ].join('\n')
  }
  return `${renderReviewBody(review, evidence)}\n${commitSection}`
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
  const { slug, branch } = worktree.config

  if (git(root, ['rev-list', '--count', `main..${branch}`]) === '0') {
    fail(`${branch} has no commits ahead of main; commit the unit before opening a PR`)
  }

  if (options.dryRun) {
    console.log(`title: ${options.title ?? git(root, ['log', '-1', '--format=%s', branch])}\n`)
    console.log(prBody(root, branch, worktree.path, managedPaths(slug).home))
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
  const body = prBody(root, branch, worktree.path, managedPaths(slug).home)
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
    writeConfig(target, { version: 1, slug, branch, port })
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
        merged: mergeStatus(root, config.branch).merged,
        path: entry.path,
      }
    })
    .filter(Boolean)

  if (rows.length === 0) {
    console.log('No managed worktrees.')
  }
  for (const row of rows) {
    console.log(
      `${row.slug.padEnd(24)} ${String(row.port).padEnd(6)} ${row.merged ? 'merged ' : 'active '} ${row.path}`,
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
    .filter((config) => config && mergeStatus(root, config.branch).merged)
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
  pnpm worktree create <slug> [--skip-install]
  pnpm worktree adopt <path> <slug> [--skip-install]
  pnpm worktree list
  pnpm worktree pr <slug> [--draft] [--dry-run] [--title <title>]
  pnpm worktree remove <slug> [--force]
  pnpm worktree cleanup

create:
  Run from the primary main checkout. Creates work/<slug> in the sibling
  <repo>-worktrees/<slug> directory with an isolated port, channels, user data,
  and disposable playground. Installs dependencies unless --skip-install is set.

adopt:
  Converts a detached harness worktree (Codex, Grok Build, hand-made) into a
  managed one: branches work/<slug> at its current HEAD, writes the managed
  config, allocates a port, and creates the playground. The checkout stays where
  the harness put it; remove <slug> later deletes that directory.

.worktreeinclude:
  create and adopt both copy the gitignored files this file lists (one relative
  path per line, \` * \` within a segment) from the primary checkout into the new
  worktree, never overwriting an existing file. Agent harnesses apply that file
  inconsistently; this script is the one mechanism.

list:
  Managed worktrees first, then any unmanaged detached checkouts a harness left
  behind, marked prunable when they sit under a harness root (~/.t3, ~/.codex,
  ~/.grok, */.claude/worktrees) and are clean and already merged into main.

pr:
  Pushes work/<slug> to origin and opens a PR into main via gh. Title defaults to
  the branch's latest commit subject; the body carries the worktree's published
  Review (Intent + Evidence) when one exists, plus the commit list. Prints the URL
  and exits when a PR is already open for the branch. --dry-run prints the title
  and body it would send and touches neither origin nor gh.

remove:
  Requires a clean worktree whose branch is merged into local main. Stops its
  recorded dev daemon, removes the checkout and branch, and permanently deletes
  its channels, user data, and playground. --force is only for abandoned work.

cleanup:
  Removes every clean managed worktree already merged into local main, then
  prunes unmanaged detached harness checkouts that are clean and whose HEAD is
  reachable from main. Never touches a worktree on a branch, a dirty one, one
  holding commits main does not have, or a hand-made checkout outside a harness
  root.
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
    create(name, { skipInstall: rest.includes('--skip-install') })
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

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error))
})
