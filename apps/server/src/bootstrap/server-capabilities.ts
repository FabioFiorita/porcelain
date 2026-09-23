import type { DismissInterruptedGitActionController } from '../controllers/dismiss-interrupted-git-action-controller.ts';
import type { GenerateCommitDraftController } from '../controllers/generate-commit-draft-controller.ts';
import type { ListCommitModelsController } from '../controllers/list-commit-models-controller.ts';
import type { ListGitBranchesController } from '../controllers/list-git-branches-controller.ts';
import type { ReadGitActionReceiptController } from '../controllers/read-git-action-receipt-controller.ts';
import type { RunGitActionController } from '../controllers/run-git-action-controller.ts';
import type {
  BrowseProjectFoldersResponse,
  DiscoverProjectsResponse,
  Project,
  ProjectParams,
  ReadInventoryResponse,
  RemoveProjectResponse,
  RenameProjectRequest,
  RenameProjectResponse,
} from '@porcelain/contracts/projects';
import type {
  EditFileRequest,
  EditFileResponse,
  ListDirectoryResponse,
  ListWorktreePathsResponse,
  ReadFileAssetResponse,
  ReadPreviewAssetsResponse,
  ReadTextFileResponse,
} from '@porcelain/contracts/files';
import type { LiveSubscription } from '@porcelain/contracts/access';
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
  ReadChangeDiffsRequest,
  ReadChangeDiffsResponse,
  ReadChangeLinesResponse,
  ReadChangesResponse,
  ReadGitStatusResponse,
} from '@porcelain/contracts/changes';

import type { ReadPublishedReviewController } from '../controllers/read-published-review-controller.ts';
import type { PublishReviewController } from '../controllers/publish-review-controller.ts';
import type { ReadReviewSummaryController } from '../controllers/read-review-summary-controller.ts';
import type { ListReviewedLayersController } from '../controllers/list-reviewed-layers-controller.ts';
import type { SetReviewedLayerController } from '../controllers/set-reviewed-layer-controller.ts';
import type { RemoveReviewedLayerController } from '../controllers/remove-reviewed-layer-controller.ts';
import type { ListCommentThreadsController } from '../controllers/list-comment-threads-controller.ts';
import type { CreateCommentThreadController } from '../controllers/create-comment-thread-controller.ts';
import type { ReplyToCommentController } from '../controllers/reply-to-comment-controller.ts';
import type { ResolveCommentThreadController } from '../controllers/resolve-comment-thread-controller.ts';
import type { MarkCommentsSeenController } from '../controllers/mark-comments-seen-controller.ts';
import type { ListReviewedFilesController } from '../controllers/list-reviewed-files-controller.ts';
import type { RemoveReviewedFileController } from '../controllers/remove-reviewed-file-controller.ts';
import type { SetReviewedFileController } from '../controllers/set-reviewed-file-controller.ts';
import type { SetReviewedFilesController } from '../controllers/set-reviewed-files-controller.ts';

export interface ServerCapabilities {
  readPublishedReviewController: Pick<ReadPublishedReviewController, 'execute'>;
  publishReviewController: Pick<PublishReviewController, 'execute'>;
  readReviewSummaryController: Pick<ReadReviewSummaryController, 'execute'>;
  listReviewedLayersController: Pick<ListReviewedLayersController, 'execute'>;
  setReviewedLayerController: Pick<SetReviewedLayerController, 'execute'>;
  removeReviewedLayerController: Pick<RemoveReviewedLayerController, 'execute'>;
  listCommentThreadsController: Pick<ListCommentThreadsController, 'execute'>;
  createCommentThreadController: Pick<CreateCommentThreadController, 'execute'>;
  replyToCommentController: Pick<ReplyToCommentController, 'execute'>;
  resolveCommentThreadController: Pick<
    ResolveCommentThreadController,
    'execute'
  >;
  markCommentsSeenController: Pick<MarkCommentsSeenController, 'execute'>;
  listReviewedFilesController: Pick<ListReviewedFilesController, 'execute'>;
  removeReviewedFileController: Pick<RemoveReviewedFileController, 'execute'>;
  setReviewedFileController: Pick<SetReviewedFileController, 'execute'>;
  setReviewedFilesController: Pick<SetReviewedFilesController, 'execute'>;
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
  runGitActionController: Pick<RunGitActionController, 'execute'>;
  readGitActionReceiptController: Pick<
    ReadGitActionReceiptController,
    'execute'
  >;
  dismissInterruptedGitActionController: Pick<
    DismissInterruptedGitActionController,
    'execute'
  >;
  listGitBranchesController: Pick<ListGitBranchesController, 'execute'>;
  listCommitModelsController: Pick<ListCommitModelsController, 'execute'>;
  generateCommitDraftController: Pick<GenerateCommitDraftController, 'execute'>;
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
  readHealthController: {
    execute(): import('@porcelain/contracts/access').ReadHealthResponse;
  };
  redeemPairingController: {
    execute(
      input: { code: string } & DeviceRegistration,
    ): Promise<RedeemedPairing>;
  };
  projects: {
    execute(
      input: ProjectParams & RenameProjectRequest,
      context: { signal?: AbortSignal },
    ): Promise<RenameProjectResponse>;
  };
  removeProjectController: {
    execute(
      input: ProjectParams,
      context: { signal?: AbortSignal },
    ): Promise<RemoveProjectResponse>;
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
    execute(context: { signal?: AbortSignal }): Promise<ReadInventoryResponse>;
  };
  discoverProjectsController: {
    execute(context: {
      signal?: AbortSignal;
    }): Promise<DiscoverProjectsResponse>;
  };
  browseProjectFoldersController: {
    execute(
      input: { path?: string },
      context: { signal?: AbortSignal },
    ): Promise<BrowseProjectFoldersResponse>;
  };
  registerProjectController: {
    execute(
      input: { path: string },
      context: { signal?: AbortSignal },
    ): Promise<Project>;
  };
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
