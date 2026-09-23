import type {
  BranchesResponse,
  RunGitActionRequest,
} from '@porcelain/contracts/git-actions';
import type {
  CommitDraft,
  CommitDraftInput,
  CommitModel,
  GitActionScope,
} from '@porcelain/git-actions/models';
import type {
  RemoveProjectInput,
  RemoveProjectOutput,
  RenameProjectInput,
  RenameProjectOutput,
  InventoryResponse,
  ProjectResponse,
  ProjectDiscoveryResponse,
  ProjectFolderResponse,
} from '@porcelain/contracts/projects';
import type {
  AssetResponse,
  DirectoryResponse,
  TextResponse,
  PreviewAssetsResponse,
  WorktreePaths,
  FileEdit as FileEditRequest,
  FileEditResult as FileEditResponse,
} from '@porcelain/contracts/files';
import type {
  PublishReview,
  ReviewResponse,
} from '@porcelain/contracts/reviews';
import type { ReviewedLayerMark } from '@porcelain/contracts/reviews';
import type { LiveSubscription } from '@porcelain/contracts/access';
import type {
  CommentCommand,
  StoredCommentThread,
} from '@porcelain/reviews/models';
import type {
  FilePreference,
  FilePreferenceChange,
} from '@porcelain/projects/models';
import type {
  AccessListing,
  DeviceRegistration,
  IssuedGrant,
  RedeemedPairing,
} from '@porcelain/access/models';
import type {
  ReviewedFilesResult,
  SetReviewedFilesResult,
  SetReviewedFileInput,
  SetReviewedFilesInput,
} from '@porcelain/reviews/models';
import type {
  ChangeDiffsRequest,
  ChangeDiffsResponse,
  ChangeLinesResponse,
  ChangesResponse,
  GitStatusResponse,
} from '@porcelain/contracts/changes';

export interface ServerCapabilities {
  listCommitsController: {
    execute(
      input: {
        worktreeId: string;
        limit?: number | undefined;
        after?: string[] | undefined;
        tip?: string | undefined;
      },
      context: { signal?: AbortSignal | undefined },
    ): Promise<import('@porcelain/contracts/changes').CommitPageResponse>;
  };
  readCommitFilesController: {
    execute(
      input: { worktreeId: string; oid: string; parent?: number | undefined },
      context: { signal?: AbortSignal | undefined },
    ): Promise<import('@porcelain/contracts/changes').CommitFilesResponse>;
  };
  readCommitDiffsController: {
    execute(
      input: {
        worktreeId: string;
        oid: string;
        parent?: number | undefined;
        paths: string[][];
      },
      context: { signal?: AbortSignal | undefined },
    ): Promise<import('@porcelain/contracts/changes').CommitDiffsResponse>;
  };
  runGitActionController: {
    execute(
      scope: GitActionScope,
      request: RunGitActionRequest,
    ): import('@porcelain/git-actions/models').GitActionReceiptView;
  };
  readGitActionReceiptController: {
    execute(
      requestId: string,
    ): import('@porcelain/git-actions/models').GitActionReceiptView;
  };
  dismissInterruptedGitActionController: {
    execute(input: GitActionScope & { requestId: string }): {
      dismissed: true;
    };
  };
  listGitBranchesController: {
    execute(
      scope: GitActionScope,
      signal?: AbortSignal,
    ): Promise<BranchesResponse>;
  };
  listCommitModelsController: {
    execute(): Promise<CommitModel[]>;
  };
  generateCommitDraftController: {
    execute(
      scope: GitActionScope,
      input: CommitDraftInput,
      signal?: AbortSignal,
    ): Promise<CommitDraft>;
  };
  readChangesController: {
    execute(
      input: { worktreeId: string },
      context: { signal?: AbortSignal },
    ): Promise<ChangesResponse>;
  };
  readChangeDiffsController: {
    execute(
      input: ChangeDiffsRequest & { worktreeId: string },
      context: { signal?: AbortSignal },
    ): Promise<ChangeDiffsResponse>;
  };
  readChangeLinesController: {
    execute(
      input: {
        worktreeId: string;
        path: string;
        from: number;
        to: number;
        at: 'head' | 'worktree';
      },
      context: { signal?: AbortSignal },
    ): Promise<ChangeLinesResponse>;
  };
  readGitStatusController: {
    execute(
      input: { worktreeId: string },
      context: { signal?: AbortSignal },
    ): Promise<GitStatusResponse>;
  };
  issuePairingController: {
    execute(input: {
      labels: string[];
      addresses: string[];
    }): Promise<{ grants: IssuedGrant[] }>;
  };
  listAccessController: {
    execute(): Promise<AccessListing>;
  };
  revokeAccessController: {
    execute(input: { id: string }): Promise<{
      revoked: boolean;
      kind?: 'grant' | 'device';
    }>;
  };
  readPublishedReviewController: {
    execute(
      input: { worktreeId: string },
      context: { signal?: AbortSignal | undefined },
    ): Promise<ReviewResponse | null>;
  };
  publishReviewController: {
    execute(
      input: { worktreeId: string; review: PublishReview },
      context: { signal?: AbortSignal | undefined },
    ): Promise<ReviewResponse>;
  };
  readReviewSummaryController: {
    execute(input: {
      token: string;
      expires: number;
      signature: string;
    }): string | null;
  };
  listReviewedLayersController: {
    execute(
      input: { worktreeId: string },
      context: { signal?: AbortSignal | undefined },
    ): Promise<{ worktreeId: string; marks: ReviewedLayerMark[] }>;
  };
  setReviewedLayerController: {
    execute(
      input: {
        worktreeId: string;
        layerId: string;
        fingerprint: string;
        reviewed: true;
      },
      context: { signal?: AbortSignal | undefined },
    ): Promise<{ worktreeId: string; marks: ReviewedLayerMark[] }>;
  };
  removeReviewedLayerController: {
    execute(
      input: { worktreeId: string; layerId: string },
      context: { signal?: AbortSignal | undefined },
    ): Promise<{ worktreeId: string; marks: ReviewedLayerMark[] }>;
  };
  readHealthController: {
    execute(): import('@porcelain/contracts/access').HealthResponse;
  };
  redeemPairingController: {
    execute(
      input: { code: string } & DeviceRegistration,
    ): Promise<RedeemedPairing>;
  };
  commentThreadsController: {
    execute(
      input: {
        command: CommentCommand;
        principal: import('@porcelain/reviews/models').CommentPrincipal;
      },
      context: { signal?: AbortSignal },
    ): Promise<StoredCommentThread[]>;
  };
  markCommentsSeenController: {
    execute(
      input: { worktreeId: string; throughRevision: number },
      context: { signal?: AbortSignal },
    ): Promise<{ worktreeId: string; seenThrough: number }>;
  };
  listReviewedFilesController: {
    execute(
      input: { worktreeId: string },
      context: { signal?: AbortSignal },
    ): Promise<ReviewedFilesResult>;
  };
  removeReviewedFileController: {
    execute(
      input: { worktreeId: string; path: string },
      context: { signal?: AbortSignal },
    ): Promise<ReviewedFilesResult>;
  };
  setReviewedFileController: {
    execute(
      input: { worktreeId: string } & SetReviewedFileInput,
      context: { signal?: AbortSignal },
    ): Promise<ReviewedFilesResult>;
  };
  setReviewedFilesController: {
    execute(
      input: { worktreeId: string } & SetReviewedFilesInput,
      context: { signal?: AbortSignal },
    ): Promise<SetReviewedFilesResult>;
  };
  projects: {
    execute(
      input: RenameProjectInput,
      context: { signal?: AbortSignal },
    ): Promise<RenameProjectOutput>;
  };
  removeProjectController: {
    execute(
      input: RemoveProjectInput,
      context: { signal?: AbortSignal },
    ): Promise<RemoveProjectOutput>;
  };
  listFilePreferencesController: {
    execute(input: {
      projectId: string;
    }): Promise<{ preferences: FilePreference[] }>;
  };
  setFilePreferenceController: {
    execute(
      input: FilePreferenceChange & { projectId: string },
    ): Promise<{ preferences: FilePreference[] }>;
  };
  readInventoryController: {
    execute(context: { signal?: AbortSignal }): Promise<InventoryResponse>;
  };
  discoverProjectsController: {
    execute(context: {
      signal?: AbortSignal;
    }): Promise<ProjectDiscoveryResponse>;
  };
  browseProjectFoldersController: {
    execute(
      input: { path?: string },
      context: { signal?: AbortSignal },
    ): Promise<ProjectFolderResponse>;
  };
  registerProjectController: {
    execute(
      input: { path: string },
      context: { signal?: AbortSignal },
    ): Promise<ProjectResponse>;
  };
  listDirectoryController: {
    execute(
      input: { worktreeId: string; path: string },
      context: { signal?: AbortSignal },
    ): Promise<DirectoryResponse>;
  };
  readTextFileController: {
    execute(
      input: { worktreeId: string; path: string },
      context: { signal?: AbortSignal },
    ): Promise<TextResponse>;
  };
  readFileAssetController: {
    execute(
      input: { worktreeId: string; path: string },
      context: { signal?: AbortSignal },
    ): Promise<AssetResponse>;
  };
  readPreviewAssetsController: {
    execute(
      input: { worktreeId: string; document: string; paths: string[] },
      context: { signal?: AbortSignal },
    ): Promise<PreviewAssetsResponse>;
  };
  editFileController: {
    execute(
      input: { worktreeId: string; command: FileEditRequest },
      context: { signal?: AbortSignal },
    ): Promise<FileEditResponse>;
  };
  listWorktreePathsController: {
    execute(
      input: { worktreeId: string },
      context: { signal?: AbortSignal },
    ): Promise<WorktreePaths>;
  };
  liveUpdates(
    send: (notice: import('@porcelain/contracts/access').LiveNotice) => void,
  ): {
    subscribe(value: LiveSubscription): Promise<void>;
    close(): void;
  };
  authenticateDevice(
    credential: string,
    address: string | null,
  ): { deviceId: string; idleMs: number } | null;
  holdForDevice(deviceId: string, connection: { close(): void }): () => void;
  issuePairing(
    labels: readonly string[],
    addresses: readonly string[],
  ): Promise<IssuedGrant[]>;
  ready(): Promise<void>;
  close(): Promise<void>;
}
