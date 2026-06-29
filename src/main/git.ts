import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { basename, isAbsolute, join, relative } from 'node:path'
import { promisify } from 'node:util'
import {
  type ChangedFile,
  type CodeSearchFile,
  type Commit,
  type DiffHunk,
  type DiffStat,
  type GrepMatch,
  parseCodeSearch,
  parseGrep,
  parseLog,
  parseNameStatus,
  parseNumstat,
  parseStatus,
  parseUnifiedDiff,
  parseWorktrees,
  synthesizeAddDiff,
  type Worktree,
} from './diff'
import { type GitSuggestion, parseSuggestions } from './suggestions'

const execFileAsync = promisify(execFile)

async function runGit(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: repoPath,
    maxBuffer: 64 * 1024 * 1024,
    // GIT_OPTIONAL_LOCKS=0 stops background reads (status/diff polls) from
    // opportunistically rewriting .git/index, which otherwise races user
    // writes (pull/commit) and fails them with "fatal: Unable to write index.".
    // It disables only the optional index refresh — required locks for real
    // mutations (pull/commit/checkout) are untouched.
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  })
  return stdout
}

const fileListCache = new Map<string, { files: string[]; at: number; refreshing: boolean }>()
const FILE_LIST_TTL = 30_000

async function refreshFileList(repoPath: string): Promise<string[]> {
  const out = await runGit(repoPath, [
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '-z',
  ])
  const files = out.split('\0').filter(Boolean)
  fileListCache.set(repoPath, { files, at: Date.now(), refreshing: false })
  return files
}

/**
 * Stale-while-revalidate: an expired cache entry is returned immediately and
 * refreshed in the background, so search never blocks on `ls-files` (slow on
 * large monorepos) after the first call. Warm via `warmFileList` on repo open.
 */
export async function gitListFiles(repoPath: string): Promise<string[]> {
  const cached = fileListCache.get(repoPath)
  if (!cached) return refreshFileList(repoPath)
  if (Date.now() - cached.at >= FILE_LIST_TTL && !cached.refreshing) {
    cached.refreshing = true
    refreshFileList(repoPath).catch(() => {
      cached.refreshing = false
    })
  }
  return cached.files
}

export function warmFileList(repoPath: string): void {
  // fire-and-forget; non-git directories simply stay uncached. Warms the finder
  // list, which also populates the tracked-file cache (it reads `gitListFiles`).
  refreshSearchList(repoPath).catch(() => {})
}

const searchListCache = new Map<string, { files: string[]; at: number; refreshing: boolean }>()

/**
 * Parse `git ls-files --others --ignored --exclude-standard --directory -z` into
 * the loose ignored FILES worth surfacing in the finder. `--directory` collapses a
 * wholly-ignored directory (`node_modules/`, `dist/`) into a single trailing-slash
 * entry, so keeping only the non-slash entries leaves the individually-ignored
 * files — `.env`, `.env.local`, … — and never the contents of an ignored dir.
 * `.DS_Store` is dropped to match the file tree's filter.
 */
export function parseLooseIgnoredFiles(output: string): string[] {
  return output
    .split('\0')
    .filter(Boolean)
    .filter((p) => !p.endsWith('/') && basename(p) !== '.DS_Store')
}

async function refreshSearchList(repoPath: string): Promise<string[]> {
  const [tracked, ignored] = await Promise.all([
    gitListFiles(repoPath),
    runGit(repoPath, [
      'ls-files',
      '--others',
      '--ignored',
      '--exclude-standard',
      '--directory',
      '-z',
    ]),
  ])
  // tracked and ignored are disjoint by definition, so no dedupe is needed.
  const files = [...tracked, ...parseLooseIgnoredFiles(ignored)]
  searchListCache.set(repoPath, { files, at: Date.now(), refreshing: false })
  return files
}

/**
 * The Cmd+P finder candidate set: `gitListFiles` (tracked + untracked-non-ignored)
 * PLUS loose individually-ignored files like `.env` that git normally hides but the
 * user still needs to open and review. Wholly-ignored directories (`node_modules`)
 * stay collapsed-and-dropped, so this never enumerates them. Stale-while-revalidate,
 * like `gitListFiles`. Distinct from `gitListFiles` because the feature/explore
 * import-walk must stay scoped to tracked files only.
 */
export async function gitListSearchFiles(repoPath: string): Promise<string[]> {
  const cached = searchListCache.get(repoPath)
  if (!cached) return refreshSearchList(repoPath)
  if (Date.now() - cached.at >= FILE_LIST_TTL && !cached.refreshing) {
    cached.refreshing = true
    refreshSearchList(repoPath).catch(() => {
      cached.refreshing = false
    })
  }
  return cached.files
}

export async function gitLog(repoPath: string, limit: number): Promise<Commit[]> {
  return parseLog(
    await runGit(repoPath, [
      'log',
      `-n${limit}`,
      '--pretty=format:%H%x1f%an%x1f%ar%x1f%s%x1e',
      '--date=relative',
    ]),
  )
}

/** Commit history for a single file — the History tab's file timeline.
 *  `--follow` tracks the file across renames so the timeline doesn't stop at a
 *  move. `filePath` arrives as an absolute viewer-tab path (or repo-relative);
 *  we relativize it so the pathspec resolves against the work-tree root. Same
 *  pretty-format as gitLog, so parseLog/Commit are reused. */
export async function gitFileLog(
  repoPath: string,
  filePath: string,
  limit: number,
): Promise<Commit[]> {
  const pathspec = isAbsolute(filePath) ? relative(repoPath, filePath) : filePath
  return parseLog(
    await runGit(repoPath, [
      'log',
      `-n${limit}`,
      '--follow',
      '--pretty=format:%H%x1f%an%x1f%ar%x1f%s%x1e',
      '--date=relative',
      '--',
      pathspec,
    ]),
  )
}

/** Full commit message (subject + body) for one commit, trailing newline trimmed. */
export async function gitCommitMessage(repoPath: string, hash: string): Promise<string> {
  const out = await runGit(repoPath, ['show', '-s', '--format=%B', '--no-color', hash])
  return out.replace(/\n+$/, '')
}

export async function gitCommitFiles(repoPath: string, hash: string): Promise<ChangedFile[]> {
  return parseNameStatus(
    await runGit(repoPath, ['show', hash, '--name-status', '--format=', '-z', '--no-color']),
  )
}

export async function gitCommitDiff(
  repoPath: string,
  hash: string,
  filePath: string,
): Promise<DiffHunk[]> {
  return parseUnifiedDiff(
    await runGit(repoPath, ['show', hash, '--no-color', '--format=', '--', filePath]),
  )
}

export async function gitStatus(repoPath: string): Promise<ChangedFile[]> {
  // --untracked-files=all lists each new file individually; the default
  // (-unormal) collapses an untracked directory into a single `dir/` row, which
  // the changes list would then try to diff as a file (readFile → EISDIR).
  return parseStatus(await runGit(repoPath, ['status', '--porcelain=v1', '-uall', '-z']))
}

export async function gitNumstat(repoPath: string): Promise<DiffStat[]> {
  return parseNumstat(await runGit(repoPath, ['diff', 'HEAD', '--numstat', '-z']))
}

/**
 * +/- counts per file for a single commit vs its first parent.
 * Root commits (no parent) diff against the empty tree — returns stats normally.
 */
export async function gitCommitNumstat(repoPath: string, hash: string): Promise<DiffStat[]> {
  return parseNumstat(await runGit(repoPath, ['show', '--numstat', '--format=', '-z', hash]))
}

export async function gitBranch(repoPath: string): Promise<string> {
  return (await runGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
}

export async function gitWorktrees(repoPath: string): Promise<Worktree[]> {
  return parseWorktrees(await runGit(repoPath, ['worktree', 'list', '--porcelain']))
}

export interface BranchRef {
  /** The name to check out. For a remote-only branch this is the short name with
   *  the remote prefix stripped, so `git checkout <name>` lets git DWIM a local
   *  tracking branch off the remote. */
  name: string
  /** The remote a remote-only branch lives on (e.g. `origin`), or `null` for a
   *  local branch. */
  remote: string | null
}

/** Local branches first (most-recently-committed first), then remote-only ones.
 *  A remote whose short name already has a local branch is dropped (the local one
 *  is what you'd check out), as is the symbolic `origin/HEAD`. */
export async function gitBranches(repoPath: string): Promise<BranchRef[]> {
  const [localOut, remoteOut] = await Promise.all([
    runGit(repoPath, [
      'for-each-ref',
      '--format=%(refname:short)',
      '--sort=-committerdate',
      'refs/heads/',
    ]),
    runGit(repoPath, [
      'for-each-ref',
      '--format=%(refname:short)',
      '--sort=-committerdate',
      'refs/remotes/',
    ]),
  ])
  const lines = (out: string): string[] =>
    out
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

  const local = lines(localOut)
  const localNames = new Set(local)
  const branches: BranchRef[] = local.map((name) => ({ name, remote: null }))

  for (const ref of lines(remoteOut)) {
    // `refname:short` renders `refs/remotes/origin/HEAD` as just `origin` and
    // `refs/remotes/origin/main` as `origin/main`; split off the first segment.
    const slash = ref.indexOf('/')
    if (slash === -1) continue // origin/HEAD — no branch part
    const remote = ref.slice(0, slash)
    const name = ref.slice(slash + 1)
    if (name === 'HEAD' || localNames.has(name)) continue
    branches.push({ name, remote })
  }
  return branches
}

/** Check out a branch in the current worktree. A name that exists only on a remote
 *  lets git DWIM a local tracking branch off it. Throws git's output (e.g. the
 *  "local changes would be overwritten" refusal on a dirty tree) so the UI can show
 *  it — git itself is the guard against clobbering uncommitted work. */
export async function gitCheckout(repoPath: string, branch: string): Promise<void> {
  await runGitChecked(repoPath, ['checkout', branch])
}

function gitErrorOutput(error: unknown): string {
  if (error !== null && typeof error === 'object') {
    if ('stderr' in error && typeof error.stderr === 'string' && error.stderr.trim() !== '') {
      return error.stderr.trim()
    }
    if ('stdout' in error && typeof error.stdout === 'string' && error.stdout.trim() !== '') {
      return error.stdout.trim()
    }
  }
  return String(error)
}

/**
 * Run a git mutation and rethrow git's own stderr/stdout (via gitErrorOutput) so the
 * UI can surface the message (e.g. a dirty-tree checkout refusal). Read-only helpers
 * call runGit directly; the mutating ones go through this so error surfacing is uniform.
 */
async function runGitChecked(repoPath: string, args: string[]): Promise<string> {
  try {
    return await runGit(repoPath, args)
  } catch (error) {
    throw new Error(gitErrorOutput(error))
  }
}

/** Stage every change (tracked + untracked). Throws git's output for the UI. */
export async function gitStageAll(repoPath: string): Promise<void> {
  await runGitChecked(repoPath, ['add', '-A'])
}

/** Unstage every change (reset the whole index to HEAD). Throws git's output for the UI. */
export async function gitUnstageAll(repoPath: string): Promise<void> {
  await runGitChecked(repoPath, ['reset', '-q'])
}

/** Stage a single path. Throws git's output for the UI. */
export async function gitStageFile(repoPath: string, path: string): Promise<void> {
  await runGitChecked(repoPath, ['add', '--', path])
}

/** Unstage a single path (restore the index entry from HEAD). */
export async function gitUnstageFile(repoPath: string, path: string): Promise<void> {
  await runGitChecked(repoPath, ['restore', '--staged', '--', path])
}

/**
 * Does `path` exist in the HEAD commit? Distinguishes a tracked file (discardable
 * by reverting to HEAD) from a brand-new one (no committed version to revert to).
 * False on an unborn branch (no HEAD yet) — everything is "new" there.
 */
export async function gitFileInHead(repoPath: string, path: string): Promise<boolean> {
  try {
    await runGit(repoPath, ['cat-file', '-e', `HEAD:${path}`])
    return true
  } catch {
    return false
  }
}

/**
 * Discard a tracked file's changes: reset both the index and the working tree to
 * the committed version. Reverts staged + unstaged edits and restores a deletion.
 */
export async function gitRestoreFromHead(repoPath: string, path: string): Promise<void> {
  await runGitChecked(repoPath, ['restore', '--staged', '--worktree', '--source=HEAD', '--', path])
}

/**
 * Drop any staged entry for `path` (resets the index to HEAD for it); leaves the
 * working-tree file in place. A no-op for an untracked path. Used when discarding a
 * new file: unstage it here, then the caller trashes the working copy.
 */
export async function gitResetPath(repoPath: string, path: string): Promise<void> {
  await runGitChecked(repoPath, ['reset', '-q', '--', path])
}

/** Commit staged changes. Throws git's output so the UI can show it. */
export async function gitCommit(repoPath: string, message: string): Promise<void> {
  await runGitChecked(repoPath, ['commit', '-m', message])
}

/** Contextual quick-command suggestions derived from branch sync + stash state. */
export async function gitSuggestions(repoPath: string): Promise<GitSuggestion[]> {
  const [statusBranch, stashList] = await Promise.all([
    runGit(repoPath, ['status', '--porcelain=v2', '--branch']),
    runGit(repoPath, ['stash', 'list']),
  ])
  return parseSuggestions(statusBranch, stashList)
}

/** The only commands the quick-command buttons may run, keyed by id. */
export const QUICK_COMMANDS: Record<string, { label: string; args: string[] }> = {
  status: { label: 'git status', args: ['status'] },
  pull: { label: 'git pull', args: ['pull'] },
  push: { label: 'git push', args: ['push'] },
  fetch: { label: 'git fetch', args: ['fetch'] },
  stash: { label: 'git stash', args: ['stash'] },
  'stash-pop': { label: 'git stash pop', args: ['stash', 'pop'] },
}

/** How `git pull` reconciles divergent branches (the user's General preference). */
export type PullMode = 'merge' | 'rebase'

/** Resolve a whitelisted quick command's git args, or null for an unknown id.
 *  `pull` is the one parameterized entry: it appends `--rebase`/`--no-rebase`
 *  per `pullMode` so the user's choice wins over their `pull.rebase` gitconfig.
 *  Every other command stays static — the whitelist is still authoritative. */
export function quickCommandArgs(id: string, pullMode: PullMode = 'merge'): string[] | null {
  const command = QUICK_COMMANDS[id]
  if (!command) return null
  if (id === 'pull') {
    return [...command.args, pullMode === 'rebase' ? '--rebase' : '--no-rebase']
  }
  return command.args
}

/** Run a whitelisted quick command; returns combined output (git logs progress
 *  to stderr — e.g. push — so both streams matter). Throws output on failure. */
export async function gitQuickCommand(
  repoPath: string,
  id: string,
  pullMode?: PullMode,
): Promise<string> {
  const args = quickCommandArgs(id, pullMode)
  if (!args) throw new Error(`unknown quick command: ${id}`)
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd: repoPath,
      maxBuffer: 64 * 1024 * 1024,
    })
    return [stderr, stdout]
      .filter((s) => s.trim() !== '')
      .join('\n')
      .trim()
  } catch (error) {
    throw new Error(gitErrorOutput(error))
  }
}

const MAX_GREP_MATCHES = 500

/**
 * `git grep` exits 1 when there are simply no matches — that's not a failure.
 * Any other exit code (or a non-exit error like a missing binary) IS a real
 * problem and must not be hidden as "no results".
 */
export function isNoMatchError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 1
}

/** Literal text search across tracked + untracked files; empty on no matches. */
export async function gitGrep(repoPath: string, query: string): Promise<GrepMatch[]> {
  try {
    const out = await runGit(repoPath, [
      'grep',
      '-n',
      '-I',
      '--untracked',
      '--fixed-strings',
      '-e',
      query,
    ])
    return parseGrep(out).slice(0, MAX_GREP_MATCHES)
  } catch (error) {
    if (isNoMatchError(error)) return [] // exit 1 = no matches, not a failure
    throw new Error(gitErrorOutput(error))
  }
}

export interface CodeSearchOptions {
  query: string
  /** Treat the query as an extended regular expression (`-E`) vs a literal (`-F`). */
  regex: boolean
  caseSensitive: boolean
  /** Comma-separated globs limiting / excluding the search (git pathspecs). */
  include: string
  exclude: string
}

export interface CodeSearchResult {
  files: CodeSearchFile[]
  /** True when whole files were dropped to stay under the match cap. */
  truncated: boolean
}

/** Context lines git grep shows on each side of a match in the Search tab. */
const CODE_SEARCH_CONTEXT = 2

function searchGlobs(value: string): string[] {
  return value
    .split(',')
    .map((glob) => glob.trim())
    .filter((glob) => glob !== '')
}

/** Keep whole files until the match cap is reached, flagging any drop. */
function capCodeSearch(files: CodeSearchFile[]): CodeSearchResult {
  const kept: CodeSearchFile[] = []
  let count = 0
  for (const file of files) {
    if (kept.length > 0 && count + file.matchCount > MAX_GREP_MATCHES) {
      return { files: kept, truncated: true }
    }
    kept.push(file)
    count += file.matchCount
  }
  return { files: kept, truncated: false }
}

/**
 * Rich repo-wide search backing the Search tab: literal/regex, case toggle,
 * include/exclude globs, and `-C` context lines grouped per file. Kept apart
 * from `gitGrep` (still used by the ⌘⇧F overlay + find-references) because the
 * output shape — context hunks, not flat matches — is genuinely different.
 */
export async function gitSearchCode(
  repoPath: string,
  options: CodeSearchOptions,
): Promise<CodeSearchResult> {
  const args = [
    'grep',
    '-n',
    '-I',
    '--untracked',
    '--heading',
    '--break',
    '-C',
    String(CODE_SEARCH_CONTEXT),
  ]
  if (!options.caseSensitive) args.push('-i')
  args.push(options.regex ? '-E' : '-F', '-e', options.query)
  const specs = [
    ...searchGlobs(options.include).map((glob) => `:(glob)${glob}`),
    ...searchGlobs(options.exclude).map((glob) => `:(exclude,glob)${glob}`),
  ]
  if (specs.length > 0) args.push('--', ...specs)
  try {
    return capCodeSearch(parseCodeSearch(await runGit(repoPath, args)))
  } catch (error) {
    if (isNoMatchError(error)) return { files: [], truncated: false }
    throw new Error(gitErrorOutput(error))
  }
}

export async function gitDiffFile(repoPath: string, filePath: string): Promise<DiffHunk[]> {
  const status = await runGit(repoPath, ['status', '--porcelain=v1', '-uall', '-z', '--', filePath])
  if (parseStatus(status)[0]?.status === 'untracked') {
    return synthesizeAddDiff(await readFile(join(repoPath, filePath), 'utf8'))
  }
  return parseUnifiedDiff(await runGit(repoPath, ['diff', 'HEAD', '--no-color', '--', filePath]))
}

/** Compute the common ancestor between `base` and HEAD. */
export async function gitMergeBase(repoPath: string, base: string): Promise<string> {
  return (await runGit(repoPath, ['merge-base', base, 'HEAD'])).trim()
}

/** List files changed between a resolved `mergeBase` SHA and HEAD. */
export async function gitRangeChangedFilesFrom(
  repoPath: string,
  mergeBase: string,
): Promise<ChangedFile[]> {
  return parseNameStatus(
    await runGit(repoPath, ['diff', '--name-status', '-z', '--no-color', `${mergeBase}..HEAD`]),
  )
}

/** List files changed between the merge-base of `base`..HEAD and HEAD. */
export async function gitRangeChangedFiles(repoPath: string, base: string): Promise<ChangedFile[]> {
  return gitRangeChangedFilesFrom(repoPath, await gitMergeBase(repoPath, base))
}

/** Unified diff for a single file over the merge-base of `base`..HEAD range. */
export async function gitRangeDiffFile(
  repoPath: string,
  base: string,
  filePath: string,
): Promise<DiffHunk[]> {
  const mergeBase = await gitMergeBase(repoPath, base)
  return parseUnifiedDiff(
    await runGit(repoPath, ['diff', '--no-color', `${mergeBase}..HEAD`, '--', filePath]),
  )
}

/**
 * The base ref a branch review is measured against: the remote's default branch
 * (origin/HEAD, e.g. "origin/main") if known, else a local main/master.
 */
export async function gitDefaultBranch(repoPath: string): Promise<string> {
  try {
    const ref = (await runGit(repoPath, ['rev-parse', '--abbrev-ref', 'origin/HEAD'])).trim()
    if (ref && ref !== 'origin/HEAD') return ref
  } catch {
    // no remote / origin/HEAD unset — fall through to local heuristics
  }
  for (const candidate of ['main', 'master']) {
    try {
      await runGit(repoPath, ['rev-parse', '--verify', '--quiet', candidate])
      return candidate
    } catch {
      // not present; try next
    }
  }
  return 'main' // last resort; range is empty if it doesn't exist
}

/** +/- counts per file over the range from a resolved `mergeBase` SHA to HEAD. */
export async function gitRangeNumstatFrom(
  repoPath: string,
  mergeBase: string,
): Promise<DiffStat[]> {
  return parseNumstat(await runGit(repoPath, ['diff', '--numstat', '-z', `${mergeBase}..HEAD`]))
}

/** +/- counts per file over the merge-base of `base`..HEAD range. */
export async function gitRangeNumstat(repoPath: string, base: string): Promise<DiffStat[]> {
  return gitRangeNumstatFrom(repoPath, await gitMergeBase(repoPath, base))
}
