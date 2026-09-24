import type { InventoryReport } from './inventory-report.ts';
import type { Inventory } from './project.ts';
import type { ProjectWorktrees } from './project-worktrees.ts';
import type { WorktreeStatuses } from './worktree-status.ts';

export type ComposeInventoryInput = {
  inventory: Inventory;
  listings: ProjectWorktrees[];
  statuses: WorktreeStatuses;
};

export type ComposeInventoryResult = InventoryReport;
