import type { WorktreeStatus } from './worktree-status.ts';

export type WorktreeReport = {
  id: string;
  path: string;
  main: boolean;
  branch: string | undefined;
  available: boolean;
  status: WorktreeStatus | undefined;
};

export type ProjectReport = {
  id: string;
  name: string;
  available: boolean;
  worktrees: WorktreeReport[];
};

export type InventoryReport = {
  environmentId: string;
  projects: ProjectReport[];
};
