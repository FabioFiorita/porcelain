import type {
  BranchesResponse,
  RunGitActionRequest,
} from '@porcelain/contracts/git-actions';
import type {
  PublishReview,
  ReviewResponse,
} from '@porcelain/contracts/review';
import type { ReviewedLayerMark } from '@porcelain/contracts/reviewed-files';
import type {
  CommitDiffsRequest,
  CommitFiles,
  CommitFilesRequest,
  CommitPage,
  CommitPageRequest,
} from '@porcelain/git/dtos/commit-history';
import type { DiscoveryIssue } from '@porcelain/git/dtos/discovery-issue';
import type { GitDiffResult } from '@porcelain/git/dtos/git-diff';
import type {
  GitChangeSelection,
  GitStatusObservation,
} from '@porcelain/git/inspection';
import type { LineRange } from '@porcelain/git/dtos/line-range';
import type { LiveConnection } from './lifecycle/live-updates.ts';
import type { ChangeList } from './models/change.ts';
import type {
  CommentCommand,
  StoredCommentThread,
} from './models/comment-thread.ts';
import type {
  CommitDraft,
  CommitDraftInput,
  CommitModel,
} from './models/commit-draft.ts';
import type { DirectoryListing, TextContent } from './models/file-content.ts';
import type { FileEdit, FileEditResult } from './models/file-edit.ts';
import type {
  FilePreference,
  FilePreferenceChange,
} from './models/file-preference.ts';
import type { GitActionReceipt, GitActionScope } from './models/git-action.ts';
import type { Inventory } from './models/inventory.ts';
import type {
  AccessListing,
  DeviceRegistration,
  IssuedGrant,
  RedeemedPairing,
} from './models/pairing.ts';
import type { AuthenticatedPrincipal } from './models/principal.ts';
import type { Project, RegisteredProject } from './models/project.ts';
import type {
  ProjectDiscovery,
  ProjectFolder,
} from './models/project-location.ts';
import type {
  ReviewedMark,
  SetReviewedFileInput,
  SetReviewedFilesInput,
} from './models/reviewed-file.ts';
import type {
  ChangeDiff,
  ExpectedFile,
} from './use-cases/read-change-diffs.ts';
import type { PreviewAsset } from './use-cases/read-preview-assets.ts';

export interface Application {
  projects: {
    rename(
      projectId: string,
      name: string,
      signal?: AbortSignal,
    ): Promise<{ id: string; name: string }>;
  };
  runGitAction(
    scope: GitActionScope,
    request: RunGitActionRequest,
  ): GitActionReceipt;
  gitBranches(
    scope: GitActionScope,
    signal?: AbortSignal,
  ): Promise<BranchesResponse>;
  liveUpdates(
    send: (
      notice: import('@porcelain/contracts/live-updates').LiveNotice,
    ) => void,
  ): LiveConnection;
  worktreePaths(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<{ worktreeId: string; paths: string[] }>;
  editFile(
    worktreeId: string,
    command: FileEdit,
    signal?: AbortSignal,
  ): Promise<FileEditResult>;
  commitModels(signal?: AbortSignal): Promise<CommitModel[]>;
  draftCommits(
    scope: GitActionScope,
    input: CommitDraftInput,
    signal?: AbortSignal,
  ): Promise<CommitDraft>;
  gitActionReceipt(requestId: string): GitActionReceipt;
  dismissInterrupted(scope: GitActionScope, requestId: string): void;

  gitStatus(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<{
    status: GitStatusObservation;
    environmentId: string;
    worktreeId: string;
  }>;
  changes(worktreeId: string, signal?: AbortSignal): Promise<ChangeList>;
  changeDiffs(
    worktreeId: string,
    expectedStatusToken: string,
    expectedFiles: readonly ExpectedFile[],
    selections: readonly GitChangeSelection[],
    signal?: AbortSignal,
  ): Promise<{
    environmentId: string;
    worktreeId: string;
    statusToken: string;
    diffs: ChangeDiff[];
  }>;
  changeLines(
    worktreeId: string,
    range: LineRange,
    signal?: AbortSignal,
  ): Promise<{
    environmentId: string;
    worktreeId: string;
    at: 'head' | 'worktree';
    path: string;
    from: number;
    to: number;
    lines: string[];
  }>;
  listReviewedFiles(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<{ worktreeId: string; marks: ReviewedMark[] }>;
  setReviewedFile(
    worktreeId: string,
    input: SetReviewedFileInput,
    signal?: AbortSignal,
  ): Promise<{ worktreeId: string; marks: ReviewedMark[] }>;
  setReviewedFiles(
    worktreeId: string,
    input: SetReviewedFilesInput,
    signal?: AbortSignal,
  ): Promise<{
    worktreeId: string;
    marks: ReviewedMark[];
    marked: string[];
    conflicts: { path: string; reason: 'stale' | 'missing' }[];
  }>;
  removeReviewedFile(
    worktreeId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<{ worktreeId: string; marks: ReviewedMark[] }>;
  removeProject(
    projectId: string,
    signal?: AbortSignal,
  ): Promise<{ deleted: boolean }>;
  markCommentsSeen(
    worktreeId: string,
    throughRevision: number,
    signal?: AbortSignal,
  ): Promise<{ worktreeId: string; seenThrough: number }>;
  environment(): { environmentId: string; projects: RegisteredProject[] };
  inventory(
    signal?: AbortSignal,
  ): Promise<{ inventory: Inventory; issues: DiscoveryIssue[] }>;
  discoverProjects(signal?: AbortSignal): Promise<ProjectDiscovery>;
  browseProjectFolders(
    path?: string,
    signal?: AbortSignal,
  ): Promise<ProjectFolder>;
  listDirectory(
    worktreeId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<DirectoryListing>;
  readAsset(
    worktreeId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<import('@porcelain/contracts/files').AssetResponse>;
  readTextFile(
    worktreeId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<TextContent>;
  previewAssets(
    worktreeId: string,
    document: string,
    paths: string[],
    signal?: AbortSignal,
  ): Promise<PreviewAsset[]>;
  register(
    checkout: string,
    signal?: AbortSignal,
  ): Promise<{ project: Project; issues: DiscoveryIssue[] }>;
  listCommits(
    worktreeId: string,
    request: CommitPageRequest,
    signal?: AbortSignal,
  ): Promise<CommitPage>;
  commitFiles(
    worktreeId: string,
    request: CommitFilesRequest,
    signal?: AbortSignal,
  ): Promise<CommitFiles>;
  commitDiffs(
    worktreeId: string,
    request: CommitDiffsRequest,
    signal?: AbortSignal,
  ): Promise<Map<string, GitDiffResult> | null>;
  listFilePreferences(
    projectId: string,
    signal?: AbortSignal,
  ): Promise<FilePreference[]>;
  setFilePreference(
    projectId: string,
    change: FilePreferenceChange,
    signal?: AbortSignal,
  ): Promise<FilePreference[]>;
  comments(
    command: CommentCommand,
    principal: AuthenticatedPrincipal,
    signal?: AbortSignal,
  ): Promise<StoredCommentThread[]>;
  review(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ReviewResponse | null>;
  publishReview(
    worktreeId: string,
    input: PublishReview,
    signal?: AbortSignal,
  ): Promise<ReviewResponse>;
  reviewSummary(
    token: string,
    expires: number,
    signature: string,
  ): string | null;
  listReviewedLayers(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<{ worktreeId: string; marks: ReviewedLayerMark[] }>;
  setReviewedLayer(
    worktreeId: string,
    input: { layerId: string; fingerprint: string; reviewed: true },
    signal?: AbortSignal,
  ): Promise<{ worktreeId: string; marks: ReviewedLayerMark[] }>;
  removeReviewedLayer(
    worktreeId: string,
    layerId: string,
    signal?: AbortSignal,
  ): Promise<{ worktreeId: string; marks: ReviewedLayerMark[] }>;
  authenticateDevice(
    credential: string,
    address: string | null,
  ): { deviceId: string; idleMs: number } | null;
  holdForDevice(deviceId: string, connection: { close(): void }): () => void;
  issuePairing(
    labels: readonly string[],
    addresses: readonly string[],
  ): Promise<IssuedGrant[]>;
  listAccess(): Promise<AccessListing>;
  revokeAccess(
    id: string,
  ): Promise<{ revoked: boolean; kind: 'grant' | 'device' | null }>;
  redeemPairing(
    code: string,
    registration: DeviceRegistration,
  ): Promise<RedeemedPairing>;
  ready(): Promise<void>;
  close(): Promise<void>;
}
