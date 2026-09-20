import type { ResolvedWorktree } from './worktree.ts';

/** A project as it is stored: where the repository is, and what to call it. */
export interface RegisteredProject {
  id: string;
  name: string;
  commonDirectory: string;
  repositoryIdentity: string;
  available: boolean;
}

/** A project with the worktrees Git listed for it just now. */
export interface Project extends RegisteredProject {
  worktrees: ResolvedWorktree[];
}
