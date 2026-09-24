import type {
  InventoryReport,
  ProjectReport,
} from '../models/inventory-report.ts';
import type { Inventory, ProjectName } from '../models/project.ts';
import type { ProjectWorktrees } from '../models/project-worktrees.ts';
import type { ReviewBadges } from '@porcelain/kernel/models';

export function projectReport(
  project: ProjectName,
  worktrees: ProjectWorktrees,
  statuses: ReviewBadges,
): ProjectReport {
  return {
    id: project.id,
    name: project.name,
    available: worktrees.available,
    worktrees: worktrees.worktrees.map((worktree) => ({
      id: worktree.id,
      path: worktree.path,
      main: worktree.main,
      branch: worktree.branch,
      available: worktree.available,
      status: statuses.get(worktree.id),
    })),
  };
}

export function registeredProjectReport(
  project: ProjectName,
  listings: readonly ProjectWorktrees[],
  statuses: ReviewBadges,
): ProjectReport {
  return projectReport(
    project,
    listings.find((listing) => listing.projectId === project.id) ?? {
      projectId: project.id,
      available: false,
      worktrees: [],
    },
    statuses,
  );
}

export function inventoryReport(
  environmentId: string,
  inventory: Inventory,
  listings: readonly ProjectWorktrees[],
  statuses: ReviewBadges,
): InventoryReport {
  const byProject = new Map(
    listings.map((listing) => [listing.projectId, listing]),
  );
  return {
    environmentId,
    projects: inventory.projects.flatMap((project) => {
      const listing = byProject.get(project.id);
      return listing ? [projectReport(project, listing, statuses)] : [];
    }),
  };
}
