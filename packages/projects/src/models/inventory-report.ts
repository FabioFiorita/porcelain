import type { ProjectUnavailableReason } from './project-unavailable-reason.ts';
import type { ReviewBadge } from '@porcelain/kernel/models';

type WorktreeReport = {
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
  worktrees: WorktreeReport[];
} & (
  | { available: true; unavailableReason?: never }
  | { available: false; unavailableReason?: ProjectUnavailableReason }
);

export type InventoryReport = {
  environmentId: string;
  projects: ProjectReport[];
};
