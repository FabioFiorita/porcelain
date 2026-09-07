import type { Worktree } from '../../models/worktree.ts';

export interface DiscoveredRepository {
  commonDirectory: string;
  repositoryIdentity: string;
  worktrees: Omit<Worktree, 'id'>[];
}
