import type { WorktreeStatus } from '../../models/worktree.ts';

export interface WorktreeStatusStore {
  status(worktreeIds: string[]): Map<string, WorktreeStatus>;
  markSeen(worktreeId: string, throughRevision: number): number;
}
