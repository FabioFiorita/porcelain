import type { RegisteredProject } from '../models/project.ts';

export type ProjectWorktree = {
  id: string;
  projectId: string;
  path: string;
  branch: string | null;
  main: boolean;
  available: boolean;
  metadataIdentity: string;
  administrativeDirectory: string;
  commonDirectory: string;
  repositoryIdentity: string;
};

export interface ProjectWorktreeReader {
  list(
    project: RegisteredProject,
    signal?: AbortSignal,
  ): Promise<{
    worktrees: ProjectWorktree[];
    issues: { path: string; error: unknown }[];
    failure?: unknown;
  }>;
}
