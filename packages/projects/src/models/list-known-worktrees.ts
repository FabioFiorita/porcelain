import type { RegisteredProject } from './project.ts';
import type { ProjectWorktrees } from './project-worktrees.ts';

export type ListKnownWorktreesInput = { projects: RegisteredProject[] };

export type ListKnownWorktreesResult = { listings: ProjectWorktrees[] };
