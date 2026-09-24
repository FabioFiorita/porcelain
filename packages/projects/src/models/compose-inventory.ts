import type { InventoryReport } from './inventory-report.ts';
import type { Inventory } from './project.ts';
import type { ProjectWorktrees } from './project-worktrees.ts';
import type { WorktreeStatuses } from '@porcelain/kernel/models';

export type ComposeInventoryInput = {
  environmentId: string;
  inventory: Inventory;
  listings: ProjectWorktrees[];
  statuses: WorktreeStatuses;
};

export type ComposeInventoryResult = InventoryReport;
