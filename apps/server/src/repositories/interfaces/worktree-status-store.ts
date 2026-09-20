import type { WorktreeStatus } from '../../models/worktree.ts';

export interface WorktreeStatusStore {
  /** The dot for every worktree in one read; absent means no dot. */
  status(worktreeIds: string[]): Map<string, WorktreeStatus>;
  /** Record that the owner has seen a worktree's discussion this far. */
  markSeen(worktreeId: string, throughRevision: number): number;
}
