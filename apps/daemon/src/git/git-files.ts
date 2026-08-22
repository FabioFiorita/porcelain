import { basename } from 'node:path'
import { settleBackground } from '@porcelain/shared/background'
import { reuseIfUnchanged, runGit } from './git-exec'

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
  const files = reuseIfUnchanged(
    fileListCache.get(repoPath)?.files,
    out.split('\0').filter(Boolean),
  )
  fileListCache.set(repoPath, { files, at: Date.now(), refreshing: false })
  return files
}

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
  // Fire-and-forget finder warm-up (also fills the tracked-file cache); non-git dirs stay uncached.
  settleBackground(refreshSearchList(repoPath), 'invalidation')
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
  const files = reuseIfUnchanged(searchListCache.get(repoPath)?.files, [
    ...tracked,
    ...parseLooseIgnoredFiles(ignored),
  ])
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
