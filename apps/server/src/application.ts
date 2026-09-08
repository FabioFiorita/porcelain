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
import type { CommentCommand, CommentThread } from './models/comment-thread.ts';
import type { DirectoryListing, TextContent } from './models/file-content.ts';
import type {
  FilePreference,
  FilePreferenceChange,
} from './models/file-preference.ts';
import type { Inventory } from './models/inventory.ts';
import type { Project } from './models/project.ts';
import type { ReviewLayer, ReviewLayers } from './models/review-layers.ts';

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
  listFilePreferences(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<FilePreference[]>;
  setFilePreference(
    worktreeId: string,
    change: FilePreferenceChange,
    signal?: AbortSignal,
  ): Promise<FilePreference[]>;
  comments(
    command: CommentCommand,
    signal?: AbortSignal,
  ): Promise<CommentThread[]>;
  reviewLayers(worktreeId: string): ReviewLayers;
  replaceReviewLayers(
    worktreeId: string,
    expectedRevision: number,
    layers: ReviewLayer[],
  ): Promise<ReviewLayers>;
  close(): Promise<void>;
}
