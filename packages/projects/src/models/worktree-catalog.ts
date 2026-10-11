import type { ProjectUnavailableReason } from './project-unavailable-reason.ts';
import type { ListedWorktree } from './listed-worktree.ts';
import type { ListProjectWorktreesResult } from './list-project-worktrees.ts';
import type { ListableProject } from './project.ts';

export type CatalogObservation = ListableProject & {
  observedAt: string;
} & (
    | { available: true; unavailableReason?: never }
    | {
        available: false;
        unavailableReason?: ProjectUnavailableReason | undefined;
      }
  );

export type CatalogEntry = {
  worktree: ListedWorktree;
  observation: CatalogObservation;
};

export type CatalogProject = {
  observation: CatalogObservation;
  worktrees: ListedWorktree[];
};

export type CatalogSnapshot = { projects: CatalogProject[] };

export type RecordWorktreeCatalogInput = {
  projects: ListableProject[];
  listings: ListProjectWorktreesResult[];
};
