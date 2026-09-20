import type { WorktreeStatusStore } from '../repositories/interfaces/worktree-status-store.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

/**
 * The owner says they have read a worktree's discussion this far.
 *
 * Explicit on purpose: the review index prefetches comments and code
 * documents list them, so a fetch is not a reading, and a reply that arrived
 * while the page sat open would be acknowledged by something nobody looked at.
 * The revision comes from what was actually rendered, which is also why this
 * is not "everything up to now".
 */
export class MarkCommentsSeen {
  private readonly worktrees: ResolveWorktree;
  private readonly statuses: WorktreeStatusStore;

  constructor(worktrees: ResolveWorktree, statuses: WorktreeStatusStore) {
    this.worktrees = worktrees;
    this.statuses = statuses;
  }

  async execute(
    worktreeId: string,
    throughRevision: number,
    signal?: AbortSignal,
  ) {
    await this.worktrees.forWriting(worktreeId, signal);
    return {
      worktreeId,
      seenThrough: this.statuses.markSeen(worktreeId, throughRevision),
    };
  }
}
