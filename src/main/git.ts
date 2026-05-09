import { execFile } from 'child_process'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'
import {
  type ChangedFile,
  type Commit,
  type DiffHunk,
  parseLog,
  parseNameStatus,
  parseStatus,
  parseUnifiedDiff,
  synthesizeAddDiff,
} from './diff'

const execFileAsync = promisify(execFile)

async function runGit(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: repoPath,
    maxBuffer: 64 * 1024 * 1024,
  })
  return stdout
}

const fileListCache = new Map<string, { files: string[]; at: number }>()
const FILE_LIST_TTL = 30_000

export async function gitListFiles(repoPath: string): Promise<string[]> {
  const cached = fileListCache.get(repoPath)
  if (cached && Date.now() - cached.at < FILE_LIST_TTL) return cached.files
  const out = await runGit(repoPath, [
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '-z',
  ])
  const files = out.split('\0').filter(Boolean)
  fileListCache.set(repoPath, { files, at: Date.now() })
  return files
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

export async function gitDiffFile(repoPath: string, filePath: string): Promise<DiffHunk[]> {
  const status = await runGit(repoPath, ['status', '--porcelain=v1', '-z', '--', filePath])
  if (parseStatus(status)[0]?.status === 'untracked') {
    return synthesizeAddDiff(await readFile(join(repoPath, filePath), 'utf8'))
  }
  return parseUnifiedDiff(await runGit(repoPath, ['diff', 'HEAD', '--no-color', '--', filePath]))
}
