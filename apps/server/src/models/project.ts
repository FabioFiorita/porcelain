import type { Worktree } from './worktree.ts';

export interface Project {
  id: string;
  name: string;
  commonDirectory: string;
  repositoryIdentity: string;
  available: boolean;
  worktrees: Worktree[];
}
