import { execFile } from 'child_process'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'
import {
  type ChangedFile,
  type Commit,
  type DiffHunk,
  type DiffStat,
  parseLog,
  parseNameStatus,
  parseNumstat,
  parseStatus,
  parseUnifiedDiff,
  parseWorktrees,
  synthesizeAddDiff,
  type Worktree,
} from './diff'

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

export async function gitDiffFile(repoPath: string, filePath: string): Promise<DiffHunk[]> {
  const status = await runGit(repoPath, ['status', '--porcelain=v1', '-z', '--', filePath])
  if (parseStatus(status)[0]?.status === 'untracked') {
    return synthesizeAddDiff(await readFile(join(repoPath, filePath), 'utf8'))
  }
  return parseUnifiedDiff(await runGit(repoPath, ['diff', 'HEAD', '--no-color', '--', filePath]))
}
