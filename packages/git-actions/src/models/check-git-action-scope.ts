import type { Worktree } from '@porcelain/kernel/models';

export type CheckGitActionScopeInput = {
  projectId: string;
  worktree: Worktree;
};
