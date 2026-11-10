import type { ProjectUnavailableReason } from './project-unavailable-reason.ts';

type WorktreeReport = {
  id: string;
  path: string;
  main: boolean;
  branch: string | undefined;
  headCommittedAt?: string;
  available: boolean;
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
