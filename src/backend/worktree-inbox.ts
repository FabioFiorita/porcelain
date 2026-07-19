import type { ThreadInfo } from '../shared/agent-protocol'
import { listThreads } from './agents/agent-manager'
import type { Worktree } from './diff'
import { gitStatus, gitWorktrees } from './git'
import { readReviewSet } from './review-store'

/**
 * One Review-inbox row: a SIBLING worktree of the current checkout that has agent work
 * awaiting review. Assembled per-worktree from the family list, its changed-file count,
 * the agent roster scoped to its exact path, and whether a Review set was pushed for it.
 */
export interface InboxRow {
  path: string
  branch: string
  /** Number of changed files in that worktree's working tree. */
  changedCount: number
  /** Threads bound to that worktree currently mid-turn ('working'). */
  workingThreads: number
  /** Threads bound to that worktree that are quiescent ('idle'). */
  idleThreads: number
  /** True when the agent pushed a Review set for that worktree's path. */
  hasReview: boolean
}

/**
 * The per-worktree probes the assembly needs, injected so the pure grouping/filtering
 * logic is unit-testable without spawning git or seeding the in-memory roster. The
 * production wiring (`worktreeInbox`) passes the real git/roster/review-store calls.
 */
export interface WorktreeInboxDeps {
  listWorktrees: (repoPath: string) => Promise<Worktree[]>
  changedCount: (path: string) => Promise<number>
  listThreads: (path: string) => Promise<ThreadInfo[]>
  hasReview: (path: string) => Promise<boolean>
}

/**
 * Build the Review inbox for `repoPath`: every OTHER worktree of the family that carries
 * any review signal. Drops the current checkout (exact-path match, both realpath-resolved
 * by git) and any worktree with no signal (`changedCount === 0 && no threads && !hasReview`).
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
          const [changedCount, threads, hasReview] = await Promise.all([
            deps.changedCount(worktree.path),
            deps.listThreads(worktree.path),
            deps.hasReview(worktree.path),
          ])
          let workingThreads = 0
          let idleThreads = 0
          for (const thread of threads) {
            if (thread.status === 'working') workingThreads += 1
            else idleThreads += 1
          }
          if (changedCount === 0 && workingThreads + idleThreads === 0 && !hasReview) {
            return null
          }
          return {
            path: worktree.path,
            branch: worktree.branch,
            changedCount,
            workingThreads,
            idleThreads,
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

/** Production Review inbox: wire the real git/roster/review-store probes. */
export async function worktreeInbox(repoPath: string): Promise<InboxRow[]> {
  return assembleWorktreeInbox(repoPath, {
    listWorktrees: gitWorktrees,
    changedCount: async (path) => (await gitStatus(path)).length,
    listThreads,
    hasReview: async (path) => (await readReviewSet(path)) !== null,
  })
}
