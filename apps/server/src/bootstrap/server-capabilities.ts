import type {
  ListGitBranchesResponse,
  RunGitActionRequest,
} from '@porcelain/contracts/git-actions';
import type {
  CommitDraft,
  CommitDraftInput,
  CommitModel,
  GitActionScope,
} from '@porcelain/git-actions/models';
import type { BrowseProjectFoldersController } from '../controllers/browse-project-folders-controller.ts';
import type { DiscoverProjectsController } from '../controllers/discover-projects-controller.ts';
import type { ListFilePreferencesController } from '../controllers/list-file-preferences-controller.ts';
import type { ReadInventoryController } from '../controllers/read-inventory-controller.ts';
import type { RegisterProjectController } from '../controllers/register-project-controller.ts';
import type { RemoveProjectController } from '../controllers/remove-project-controller.ts';
import type { RenameProjectController } from '../controllers/rename-project-controller.ts';
import type { SetFilePreferenceController } from '../controllers/set-file-preference-controller.ts';
import type {
  EditFileRequest,
  EditFileResponse,
  ListDirectoryResponse,
  ListWorktreePathsResponse,
  ReadFileAssetResponse,
  ReadPreviewAssetsResponse,
  ReadTextFileResponse,
} from '@porcelain/contracts/files';
import type {
  PublishedReview,
  PublishReviewRequest,
} from '@porcelain/contracts/reviews';
import type { ReviewedLayerMark } from '@porcelain/contracts/reviews';
import type { LiveSubscription } from '@porcelain/contracts/access';
import type {
  CommentCommand,
  StoredCommentThread,
} from '@porcelain/reviews/models';
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
  ReadChangeDiffsRequest,
  ReadChangeDiffsResponse,
  ReadChangeLinesResponse,
  ReadChangesResponse,
  ReadGitStatusResponse,
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
    ): Promise<import('@porcelain/contracts/changes').ListCommitsResponse>;
  };
  readCommitFilesController: {
    execute(
      input: { worktreeId: string; oid: string; parent?: number | undefined },
      context: { signal?: AbortSignal | undefined },
    ): Promise<import('@porcelain/contracts/changes').ReadCommitFilesResponse>;
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
    ): Promise<import('@porcelain/contracts/changes').ReadCommitDiffsResponse>;
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
    ): Promise<ListGitBranchesResponse>;
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
    ): Promise<ReadChangesResponse>;
  };
  readChangeDiffsController: {
    execute(
      input: ReadChangeDiffsRequest & { worktreeId: string },
      context: { signal?: AbortSignal },
    ): Promise<ReadChangeDiffsResponse>;
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
    ): Promise<ReadChangeLinesResponse>;
  };
  readGitStatusController: {
    execute(
      input: { worktreeId: string },
      context: { signal?: AbortSignal },
    ): Promise<ReadGitStatusResponse>;
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
    ): Promise<PublishedReview | null>;
  };
  publishReviewController: {
    execute(
      input: { worktreeId: string; review: PublishReviewRequest },
      context: { signal?: AbortSignal | undefined },
    ): Promise<PublishedReview>;
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
    execute(): import('@porcelain/contracts/access').ReadHealthResponse;
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
  projects: Pick<RenameProjectController, 'execute'>;
  removeProjectController: Pick<RemoveProjectController, 'execute'>;
  listFilePreferencesController: Pick<ListFilePreferencesController, 'execute'>;
  setFilePreferenceController: Pick<SetFilePreferenceController, 'execute'>;
  readInventoryController: Pick<ReadInventoryController, 'execute'>;
  discoverProjectsController: Pick<DiscoverProjectsController, 'execute'>;
  browseProjectFoldersController: Pick<
    BrowseProjectFoldersController,
    'execute'
  >;
  registerProjectController: Pick<RegisterProjectController, 'execute'>;
  listDirectoryController: {
    execute(
      input: { worktreeId: string; path: string },
      context: { signal?: AbortSignal },
    ): Promise<ListDirectoryResponse>;
  };
  readTextFileController: {
    execute(
      input: { worktreeId: string; path: string },
      context: { signal?: AbortSignal },
    ): Promise<ReadTextFileResponse>;
  };
  readFileAssetController: {
    execute(
      input: { worktreeId: string; path: string },
      context: { signal?: AbortSignal },
    ): Promise<ReadFileAssetResponse>;
  };
  readPreviewAssetsController: {
    execute(
      input: { worktreeId: string; document: string; paths: string[] },
      context: { signal?: AbortSignal },
    ): Promise<ReadPreviewAssetsResponse>;
  };
  editFileController: {
    execute(
      input: { worktreeId: string; command: EditFileRequest },
      context: { signal?: AbortSignal },
    ): Promise<EditFileResponse>;
  };
  listWorktreePathsController: {
    execute(
      input: { worktreeId: string },
      context: { signal?: AbortSignal },
    ): Promise<ListWorktreePathsResponse>;
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
