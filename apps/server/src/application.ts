import type {
  CommitChanges,
  CommitChangesRequest,
  CommitPage,
  CommitPageRequest,
} from '@porcelain/git/dtos/commit-history';
import type { DiscoveryIssue } from '@porcelain/git/dtos/discovery-issue';
import type { GitActionIntent } from '@porcelain/git/dtos/git-action';
import type { GitDiffResult } from '@porcelain/git/dtos/git-diff';
import type {
  GitChangeSelection,
  GitOrdinaryChange,
  GitStatusObservation,
} from '@porcelain/git/dtos/git-status';
import type {
  Artifact,
  ArtifactMetadata,
  ArtifactUpload,
} from './models/artifact.ts';
import type { CommentCommand, CommentThread } from './models/comment-thread.ts';
import type { DirectoryListing, TextContent } from './models/file-content.ts';
import type {
  FilePreference,
  FilePreferenceChange,
} from './models/file-preference.ts';
import type {
  GitActionPreparation,
  GitActionReceipt,
  GitActionScope,
} from './models/git-action.ts';
import type { Inventory } from './models/inventory.ts';
import type { Project } from './models/project.ts';
import type { ReviewLayer, ReviewLayers } from './models/review-layers.ts';

export interface Application {
  prepareFetch(
    scope: GitActionScope,
    input: Omit<Extract<GitActionIntent, { action: 'fetch' }>, 'action'>,
    signal?: AbortSignal,
  ): Promise<GitActionPreparation>;
  executeFetch(
    scope: GitActionScope,
    input: { requestId: string; preparationId: string },
    signal?: AbortSignal,
  ): GitActionReceipt;
  preparePush(
    scope: GitActionScope,
    input: Omit<Extract<GitActionIntent, { action: 'push' }>, 'action'>,
    signal?: AbortSignal,
  ): Promise<GitActionPreparation>;
  executePush(
    scope: GitActionScope,
    input: { requestId: string; preparationId: string },
    signal?: AbortSignal,
  ): GitActionReceipt;
  prepareCommit(
    scope: GitActionScope,
    input: Omit<Extract<GitActionIntent, { action: 'commit' }>, 'action'>,
    signal?: AbortSignal,
  ): Promise<GitActionPreparation>;
  executeCommit(
    scope: GitActionScope,
    input: { requestId: string; preparationId: string },
    signal?: AbortSignal,
  ): GitActionReceipt;
  prepareStashCreate(
    scope: GitActionScope,
    input: Omit<Extract<GitActionIntent, { action: 'stash-create' }>, 'action'>,
    signal?: AbortSignal,
  ): Promise<GitActionPreparation>;
  executeStashCreate(
    scope: GitActionScope,
    input: { requestId: string; preparationId: string },
    signal?: AbortSignal,
  ): GitActionReceipt;
  prepareStashApply(
    scope: GitActionScope,
    input: { stashOid: string; restoreIndex: boolean },
    signal?: AbortSignal,
  ): Promise<GitActionPreparation>;
  executeStashApply(
    scope: GitActionScope,
    input: { requestId: string; preparationId: string },
    signal?: AbortSignal,
  ): GitActionReceipt;
  prepareStashPop(
    scope: GitActionScope,
    input: { stashOid: string; restoreIndex: boolean },
    signal?: AbortSignal,
  ): Promise<GitActionPreparation>;
  executeStashPop(
    scope: GitActionScope,
    input: { requestId: string; preparationId: string },
    signal?: AbortSignal,
  ): GitActionReceipt;
  gitActionReceipt(requestId: string): GitActionReceipt;

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
  removeProject(
    projectId: string,
    signal?: AbortSignal,
  ): Promise<{ deleted: boolean }>;
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
  uploadArtifact(
    worktreeId: string,
    input: ArtifactUpload,
    signal?: AbortSignal,
  ): Promise<ArtifactMetadata>;
  listArtifacts(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ArtifactMetadata[]>;
  getArtifact(
    worktreeId: string,
    artifactId: string,
    signal?: AbortSignal,
  ): Promise<Artifact>;
  deleteArtifact(
    worktreeId: string,
    artifactId: string,
    signal?: AbortSignal,
  ): Promise<{ deleted: boolean }>;
  close(): Promise<void>;
}
