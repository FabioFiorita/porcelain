import { gitDiffFile, gitListFiles, gitStatus, gitWorktrees } from '../../git/git'
import type { ReviewGit } from './review-reading-capabilities'

/**
 * The four Git facts the Review readings need, and nothing else: working-tree hunks
 * for one file, the tracked file list the exploration walk resolves imports against,
 * the worktree family, and a changed-file count. Review declares its own port rather
 * than consuming the Git feature's, whose `GitProjectResult` wrapper would turn a
 * broken sibling worktree from a dropped inbox row into a typed failure.
 */
export function createGitReviewReading(): ReviewGit {
  return Object.freeze({
    fileHunks: async (repoPath: string, path: string) => (await gitDiffFile(repoPath, path)).hunks,
    listFiles: (repoPath: string) => gitListFiles(repoPath),
    worktrees: (repoPath: string) => gitWorktrees(repoPath),
    changedCount: async (repoPath: string) => (await gitStatus(repoPath)).length,
  })
}
