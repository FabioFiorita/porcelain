import type {
  InventoryResponse,
  ProjectResponse,
} from '@porcelain/contracts/inventory';

export type Inventory = InventoryResponse;
export type Project = ProjectResponse;

export function selectedWorktree(inventory: Inventory, id: string | undefined) {
  return inventory.projects
    .flatMap((project) => project.worktrees)
    .find((entry) => entry.id === id);
}

export function worktreeLabel(branch: string | null) {
  return branch?.replace(/^refs\/heads\//, '') ?? 'Detached HEAD';
}
