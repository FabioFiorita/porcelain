import { readReviewSet } from '../stores/review-store'
import type { Worktree } from './diff'
import { gitStatus, gitWorktrees } from './git'

/**
 * One Review-inbox row: a SIBLING worktree of the current checkout that has work awaiting
 * review. Assembled per-worktree from the family list, its changed-file count, and whether
 * a Review set was pushed for it.
 */
export interface InboxRow {
  path: string
  branch: string
  /** Number of changed files in that worktree's working tree. */
  changedCount: number
  /** True when the agent pushed a Review set for that worktree's path. */
  hasReview: boolean
}

/**
 * The per-worktree probes the assembly needs, injected so the pure grouping/filtering
 * logic is unit-testable without spawning git. The production wiring (`worktreeInbox`)
 * passes the real git/review-store calls.
 */
export interface WorktreeInboxDeps {
  listWorktrees: (repoPath: string) => Promise<Worktree[]>
  changedCount: (path: string) => Promise<number>
  hasReview: (path: string) => Promise<boolean>
}

/**
 * Build the Review inbox for `repoPath`: every OTHER worktree of the family that carries
 * any review signal. Drops the current checkout (exact-path match, both realpath-resolved
 * by git) and any worktree with no signal (`changedCount === 0 && !hasReview`).
 * A per-worktree probe failure (a deleted checkout git still lists) yields no row rather
 * than throwing the whole inbox — the surface must survive a stale worktree entry.
 */
export async function assembleWorktreeInbox(
  repoPath: string,
  deps: WorktreeInboxDeps,
): Promise<InboxRow[]> {
  const worktrees = await deps.listWorktrees(repoPath)
  const rows = await Promise.all(
    worktrees
      .filter((worktree) => worktree.path !== repoPath)
      .map(async (worktree): Promise<InboxRow | null> => {
        try {
          const [changedCount, hasReview] = await Promise.all([
            deps.changedCount(worktree.path),
            deps.hasReview(worktree.path),
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

/** Production Review inbox: wire the real git/review-store probes. */
export async function worktreeInbox(repoPath: string): Promise<InboxRow[]> {
  return assembleWorktreeInbox(repoPath, {
    listWorktrees: gitWorktrees,
    changedCount: async (path: string) => (await gitStatus(path)).length,
    hasReview: async (path: string) => (await readReviewSet(path)) !== null,
  })
}
