import { join } from 'node:path'
import { imageMimeForPath, isGitBinaryDiff } from '../fs/image-mime'
import {
  type ChangedFile,
  type DiffFileResult,
  type DiffStat,
  diffFileStatus,
  parseNameStatus,
  parseNumstat,
  parseUnifiedDiff,
} from './diff'
import { contextArgs, imagePreview } from './git-diff-file'
import { runGit } from './git-exec'
import { gitResolveCompareBase } from './git-refs'

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

/** Unified diff for a single file over the merge-base of `base`..HEAD range.
 *  `base` arrives from a client, so it is re-validated here rather than trusted. */
export async function gitRangeDiffFile(
  repoPath: string,
  base: string,
  filePath: string,
  context?: number,
): Promise<DiffFileResult> {
  const mergeBase = await gitMergeBase(repoPath, await gitResolveCompareBase(repoPath, base))
  const raw = await runGit(repoPath, [
    'diff',
    '--no-color',
    ...contextArgs(context),
    `${mergeBase}..HEAD`,
    '--',
    filePath,
  ])
  const status = diffFileStatus(raw)
  const mime = imageMimeForPath(filePath)
  if (mime || isGitBinaryDiff(raw)) {
    // Range review is of committed content; preview HEAD when the image still exists.
    if (mime && status !== 'deleted') {
      const dataUrl = await imagePreview(join(repoPath, filePath), mime)
      if (dataUrl) return { hunks: [], status, image: { dataUrl } }
    }
    return { hunks: [], status, binary: true }
  }
  return { hunks: parseUnifiedDiff(raw), status }
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
