import type { WorktreeStatusStore } from '../repositories/interfaces/worktree-status-store.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

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
