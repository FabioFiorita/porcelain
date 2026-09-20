import type {
  CommitDiffsRequest,
  CommitFiles,
  CommitFilesRequest,
  CommitPage,
  CommitPageRequest,
} from '@porcelain/git/dtos/commit-history';
import type { DiscoveryIssue } from '@porcelain/git/dtos/discovery-issue';
import type { GitActionIntent } from '@porcelain/git/dtos/git-action';
import type { GitDiffResult } from '@porcelain/git/dtos/git-diff';
import type {
  GitChangeSelection,
  GitStatusObservation,
} from '@porcelain/git/dtos/git-status';
import type { LineRange } from '@porcelain/git/dtos/line-range';
import type {
  Artifact,
  ArtifactMetadata,
  ArtifactUpload,
} from './models/artifact.ts';
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
import type {
  GitActionPreparation,
  GitActionReceipt,
  GitActionScope,
} from './models/git-action.ts';
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
import type { ReviewLayer, ReviewLayers } from './models/review-layers.ts';
import type {
  ReviewedMark,
  SetReviewedFileInput,
} from './models/reviewed-file.ts';
import type {
  ChangeDiff,
  ExpectedFile,
} from './use-cases/read-change-diffs.ts';

export interface Application {
  /** Every name quick open can offer, read once per opening. */
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
  preparePull(
    scope: GitActionScope,
    input: Omit<Extract<GitActionIntent, { action: 'pull' }>, 'action'>,
    signal?: AbortSignal,
  ): Promise<GitActionPreparation>;
  executePull(
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
  /** What changed, with a fingerprint per path and no content. */
  changes(worktreeId: string, signal?: AbortSignal): Promise<ChangeList>;
  /**
   * The hunks of the files named, in one Git process per scope. The token is
   * the one the list was read at: a mismatch is refused rather than answered
   * against a checkout that has moved on.
   */
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
  /** A range of lines, from the last commit or from the working file. */
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
  removeReviewedFile(
    worktreeId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<{ worktreeId: string; marks: ReviewedMark[] }>;
  removeProject(
    projectId: string,
    signal?: AbortSignal,
  ): Promise<{ deleted: boolean }>;
  /** The owner names a project; a name they chose is never derived over. */
  renameProject(
    projectId: string,
    name: string,
    signal?: AbortSignal,
  ): Promise<{ id: string; name: string }>;
  /**
   * Record how far the owner has read a worktree's discussion. The revision
   * comes from what was displayed, so a reply that arrived after the snapshot
   * stays unseen.
   */
  markCommentsSeen(
    worktreeId: string,
    throughRevision: number,
    signal?: AbortSignal,
  ): Promise<{ worktreeId: string; seenThrough: number }>;
  /**
   * Environment and projects, without touching Git.
   *
   * Health and pairing need the environment id on every request; asking Git
   * for a worktree list to answer that would be absurd.
   */
  environment(): { environmentId: string; projects: RegisteredProject[] };
  /** Projects with the worktrees Git lists for them right now. */
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
  reviewLayers(worktreeId: string, signal?: AbortSignal): Promise<ReviewLayers>;
  replaceReviewLayers(
    worktreeId: string,
    expectedRevision: number,
    layers: ReviewLayer[],
    signal?: AbortSignal,
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
  /**
   * Resolve a device credential without touching the database, and move its
   * last-seen time forward. Returns the device id, or null for every failure
   * alike so nothing here distinguishes unknown from revoked or dormant.
   */
  authenticateDevice(
    credential: string,
    address: string | null,
  ): { deviceId: string; idleMs: number } | null;
  /** Register a held response so revoking the device can cut it. */
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
  /** Resolves once the first refresh at startup has settled. */
  ready(): Promise<void>;
  close(): Promise<void>;
}
