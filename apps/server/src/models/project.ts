import type { ResolvedWorktree, WorktreeStatus } from './worktree.ts';
import type { RegisteredProject } from '@porcelain/projects/models';

export type { RegisteredProject } from '@porcelain/projects/models';

export interface Project extends RegisteredProject {
  worktrees: (ResolvedWorktree & { status: WorktreeStatus | null })[];
}
