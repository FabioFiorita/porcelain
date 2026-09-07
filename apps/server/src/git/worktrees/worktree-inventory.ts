import type { Worktree } from '../../models/worktree.ts';

export interface DiscoveredRepository {
  commonDirectory: string;
  repositoryIdentity: string;
  worktrees: Omit<Worktree, 'id'>[];
}

export interface WorktreeReader {
  listWorktrees(): Promise<DiscoveredRepository>;
}

export type GitFactory = (checkout: string) => WorktreeReader;
