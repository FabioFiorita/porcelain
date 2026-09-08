import type { DiscoveryIssue } from './git/dtos/discovery-issue.ts';
import type { Inventory } from './models/inventory.ts';
import type { Project } from './models/project.ts';
import type { ReadWorktreeDiff } from './use-cases/read-worktree-diff.ts';
import type { ReadWorktreeStatus } from './use-cases/read-worktree-status.ts';

export interface Application {
  gitStatus: ReadWorktreeStatus['execute'];
  gitDiff: ReadWorktreeDiff['execute'];
  inventory(): Inventory;
  register(
    checkout: string,
    signal?: AbortSignal,
  ): Promise<{ project: Project; issues: DiscoveryIssue[] }>;
  refresh(
    signal?: AbortSignal,
  ): Promise<{ inventory: Inventory; issues: DiscoveryIssue[] }>;
  close(): Promise<void>;
}
