import type { Worktree } from '@porcelain/kernel/models';

export type LaneKeys = {
  access(): string;
  inventory(): string;
  filesystem(): string;
  project(projectId: string): string;
  repository(worktree: Worktree): string;
};
