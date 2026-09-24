import type { ReviewBadge } from '@porcelain/kernel/models';

export type WorktreeReport = {
  id: string;
  path: string;
  main: boolean;
  branch: string | undefined;
  available: boolean;
  status: ReviewBadge | undefined;
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
