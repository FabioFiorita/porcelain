import type { InboxRow, ReviewGit, ReviewReadingSources } from './review-reading-capabilities'

/**
 * Build the Review inbox for the project: every OTHER worktree of the family that
 * carries any review signal. Drops the current checkout (exact-path match, both
 * realpath-resolved by git) and any worktree with no signal
 * (`changedCount === 0 && !hasReview`). A per-worktree probe failure (a deleted
 * checkout git still lists) yields no row rather than throwing the whole inbox —
 * the surface must survive a stale worktree entry.
 */
export function createListReviewInbox(deps: { git: ReviewGit; sources: ReviewReadingSources }) {
  return async ({ projectPath }: { projectPath: string }): Promise<InboxRow[]> => {
    const worktrees = await deps.git.worktrees(projectPath)
    const rows = await Promise.all(
      worktrees
        .filter((worktree) => worktree.path !== projectPath)
        .map(async (worktree): Promise<InboxRow | null> => {
          try {
            const [changedCount, hasReview] = await Promise.all([
              deps.git.changedCount(worktree.path),
              deps.sources.hasReviewSet(worktree.path),
            ])
            if (changedCount === 0 && !hasReview) return null
            return {
              path: worktree.path,
              branch: worktree.branch,
              changedCount,
              hasReview,
            }
          } catch {
            // A broken/missing worktree dir (deleted checkout still listed by git): skip it.
            return null
          }
        }),
    )
    return rows.filter((row): row is InboxRow => row !== null)
  }
}
