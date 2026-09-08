import type {
  CommitChanges,
  CommitChangesRequest,
  CommitPage,
  CommitPageRequest,
} from './git/dtos/commit-history.ts';
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
