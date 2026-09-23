import type { WorktreeStatus } from '../models/worktree-status.ts';

export interface WorktreeStatusStore {
  status(worktreeIds: string[]): Map<string, WorktreeStatus>;
}
