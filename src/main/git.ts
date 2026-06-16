import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import {
  type ChangedFile,
  type Commit,
  type DiffHunk,
  type DiffStat,
  type GrepMatch,
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
  // fire-and-forget; non-git directories simply stay uncached
  refreshFileList(repoPath).catch(() => {})
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

export async function gitBranch(repoPath: string): Promise<string> {
  return (await runGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
}

export async function gitWorktrees(repoPath: string): Promise<Worktree[]> {
  return parseWorktrees(await runGit(repoPath, ['worktree', 'list', '--porcelain']))
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

/** Stage every change (tracked + untracked). Throws git's output for the UI. */
export async function gitStageAll(repoPath: string): Promise<void> {
  try {
    await runGit(repoPath, ['add', '-A'])
  } catch (error) {
    throw new Error(gitErrorOutput(error))
  }
}

/** Stage a single path. Throws git's output for the UI. */
export async function gitStageFile(repoPath: string, path: string): Promise<void> {
  try {
    await runGit(repoPath, ['add', '--', path])
  } catch (error) {
    throw new Error(gitErrorOutput(error))
  }
}

/** Unstage a single path (restore the index entry from HEAD). */
export async function gitUnstageFile(repoPath: string, path: string): Promise<void> {
  try {
    await runGit(repoPath, ['restore', '--staged', '--', path])
  } catch (error) {
    throw new Error(gitErrorOutput(error))
  }
}

/** Commit staged changes. Throws git's output so the UI can show it. */
export async function gitCommit(repoPath: string, message: string): Promise<void> {
  try {
    await runGit(repoPath, ['commit', '-m', message])
  } catch (error) {
    throw new Error(gitErrorOutput(error))
  }
}

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

export async function gitDiffFile(repoPath: string, filePath: string): Promise<DiffHunk[]> {
  const status = await runGit(repoPath, ['status', '--porcelain=v1', '-uall', '-z', '--', filePath])
  if (parseStatus(status)[0]?.status === 'untracked') {
    return synthesizeAddDiff(await readFile(join(repoPath, filePath), 'utf8'))
  }
  return parseUnifiedDiff(await runGit(repoPath, ['diff', 'HEAD', '--no-color', '--', filePath]))
}
