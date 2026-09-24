import type { WorktreeStatus } from '../models/worktree-status.ts';

export interface WorktreeStatusStore {
  status(input: { worktreeIds: string[] }): Map<string, WorktreeStatus>;
}
