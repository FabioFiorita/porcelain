import type { ResolvedWorktree, WorktreeStatus } from './worktree.ts';

/** A project as it is stored: where the repository is, and what to call it. */
export interface RegisteredProject {
  id: string;
  name: string;
  /** True once the owner has renamed it; a derived name follows `origin`. */
  namedByOwner: boolean;
  commonDirectory: string;
  repositoryIdentity: string;
  available: boolean;
}

/** A project with the worktrees Git listed for it just now, and their dots. */
export interface Project extends RegisteredProject {
  worktrees: (ResolvedWorktree & { status: WorktreeStatus | null })[];
}
