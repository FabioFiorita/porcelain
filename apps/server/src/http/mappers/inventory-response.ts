import type {
  InventoryResponse,
  ProjectResponse,
} from '@porcelain/contracts/inventory';
import type { Inventory } from '../../models/inventory.ts';
import type { Project } from '../../models/project.ts';

export function toProjectResponse(project: Project): ProjectResponse {
  return {
    id: project.id,
    name: project.name,
    available: project.available,
    worktrees: project.worktrees.map((worktree) => ({
      id: worktree.id,
      path: worktree.path,
      main: worktree.main,
      branch: worktree.branch,
      available: worktree.available,
    })),
  };
}

export function toInventoryResponse(inventory: Inventory): InventoryResponse {
  return {
    environmentId: inventory.environmentId,
    projects: inventory.projects.map(toProjectResponse),
  };
}
