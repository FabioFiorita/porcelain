import type { DiscoveryIssue } from './git/dtos/discovery-issue.ts';
import type { GitDiffResult } from './git/dtos/git-diff.ts';
import type {
  GitChangeSelection,
  GitOrdinaryChange,
  GitStatusObservation,
} from './git/dtos/git-status.ts';
import type { DirectoryListing, TextContent } from './models/file-content.ts';
import type { Inventory } from './models/inventory.ts';
import type { Project } from './models/project.ts';

export interface Application {
  gitStatus(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<{
    status: GitStatusObservation;
    environmentId: string;
    worktreeId: string;
  }>;
  gitDiff(
    worktreeId: string,
    expectedStatusToken: string,
    selection: GitChangeSelection,
    signal?: AbortSignal,
  ): Promise<{
    environmentId: string;
    worktreeId: string;
    statusToken: string;
    change: GitOrdinaryChange;
    content: GitDiffResult;
  }>;
  inventory(): Inventory;
  listDirectory(
    worktreeId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<DirectoryListing>;
  readTextFile(
    worktreeId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<TextContent>;
  register(
    checkout: string,
    signal?: AbortSignal,
  ): Promise<{ project: Project; issues: DiscoveryIssue[] }>;
  refresh(
    signal?: AbortSignal,
  ): Promise<{ inventory: Inventory; issues: DiscoveryIssue[] }>;
  close(): Promise<void>;
}
