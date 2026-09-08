import type {
  CommitChanges,
  CommitChangesRequest,
  CommitPage,
  CommitPageRequest,
} from './git/dtos/commit-history.ts';
import type { DiscoveryIssue } from './git/dtos/discovery-issue.ts';
import type { Inventory } from './models/inventory.ts';
import type { Project } from './models/project.ts';

export interface Application {
  inventory(): Inventory;
  register(
    checkout: string,
    signal?: AbortSignal,
  ): Promise<{ project: Project; issues: DiscoveryIssue[] }>;
  refresh(
    signal?: AbortSignal,
  ): Promise<{ inventory: Inventory; issues: DiscoveryIssue[] }>;
  listCommits(
    worktreeId: string,
    request: CommitPageRequest,
    signal?: AbortSignal,
  ): Promise<CommitPage>;
  inspectCommitChanges(
    worktreeId: string,
    request: CommitChangesRequest,
    signal?: AbortSignal,
  ): Promise<CommitChanges>;
  close(): Promise<void>;
}
