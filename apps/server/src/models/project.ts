import type { ResolvedWorktree, WorktreeStatus } from './worktree.ts';

export interface RegisteredProject {
  id: string;
  name: string;
  namedByOwner: boolean;
  commonDirectory: string;
  repositoryIdentity: string;
  available: boolean;
}

export interface Project extends RegisteredProject {
  worktrees: (ResolvedWorktree & { status: WorktreeStatus | null })[];
}
