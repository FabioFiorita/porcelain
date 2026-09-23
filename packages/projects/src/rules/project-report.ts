import type { ProjectReport } from '../models/inventory-report.ts';
import type { RegisteredProject } from '../models/project.ts';
import type { ProjectWorktrees } from '../models/worktree-listing.ts';
import type { WorktreeStatuses } from '../models/worktree-status.ts';

export function projectReport(
  project: Pick<RegisteredProject, 'id' | 'name'>,
  worktrees: ProjectWorktrees,
  statuses: WorktreeStatuses,
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
