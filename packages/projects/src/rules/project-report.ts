import type {
  InventoryReport,
  ProjectReport,
} from '../models/inventory-report.ts';
import type { Inventory, ProjectName } from '../models/project.ts';
import type { ProjectWorktrees } from '../models/project-worktrees.ts';

function projectReport(
  project: ProjectName,
  worktrees: ProjectWorktrees,
): ProjectReport {
  return {
    id: project.id,
    name: project.name,
    ...(worktrees.available
      ? { available: true as const }
      : {
          available: false as const,
          ...(worktrees.unavailableReason
            ? { unavailableReason: worktrees.unavailableReason }
            : {}),
        }),
    worktrees: worktrees.worktrees.map((worktree) => ({
      id: worktree.id,
      path: worktree.path,
      main: worktree.main,
      branch: worktree.branch?.replace(/^refs\/heads\//u, ''),
      ...(worktree.headCommittedAt
        ? { headCommittedAt: worktree.headCommittedAt }
        : {}),
      available: worktree.available,
    })),
  };
}

export function registeredProjectReport(
  project: ProjectName,
  listings: readonly ProjectWorktrees[],
): ProjectReport {
  return projectReport(
    project,
    listings.find((listing) => listing.projectId === project.id) ?? {
      projectId: project.id,
      available: false,
      worktrees: [],
    },
  );
}

export function inventoryReport(
  environmentId: string,
  inventory: Inventory,
  listings: readonly ProjectWorktrees[],
): InventoryReport {
  const byProject = new Map(
    listings.map((listing) => [listing.projectId, listing]),
  );
  return {
    environmentId,
    projects: inventory.projects.flatMap((project) => {
      const listing = byProject.get(project.id);
      return listing ? [projectReport(project, listing)] : [];
    }),
  };
}
