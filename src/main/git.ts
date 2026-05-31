import { execFile } from 'child_process'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'
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
  return parseStatus(await runGit(repoPath, ['status', '--porcelain=v1', '-z']))
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

/** Stage everything and commit. Throws git's output so the UI can show it. */
export async function gitCommitAll(repoPath: string, message: string): Promise<void> {
  await runGit(repoPath, ['add', '-A'])
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
  fetch: { label: 'git fetch --all --prune', args: ['fetch', '--all', '--prune'] },
  stash: { label: 'git stash', args: ['stash'] },
  'stash-pop': { label: 'git stash pop', args: ['stash', 'pop'] },
}

/** Run a whitelisted quick command; returns combined output (git logs progress
 *  to stderr — e.g. push — so both streams matter). Throws output on failure. */
export async function gitQuickCommand(repoPath: string, id: string): Promise<string> {
  const command = QUICK_COMMANDS[id]
  if (!command) throw new Error(`unknown quick command: ${id}`)
  try {
    const { stdout, stderr } = await execFileAsync('git', command.args, {
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
  } catch {
    return [] // git grep exits 1 when nothing matches
  }
}

export async function gitDiffFile(repoPath: string, filePath: string): Promise<DiffHunk[]> {
  const status = await runGit(repoPath, ['status', '--porcelain=v1', '-z', '--', filePath])
  if (parseStatus(status)[0]?.status === 'untracked') {
    return synthesizeAddDiff(await readFile(join(repoPath, filePath), 'utf8'))
  }
  return parseUnifiedDiff(await runGit(repoPath, ['diff', 'HEAD', '--no-color', '--', filePath]))
}
