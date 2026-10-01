import type { IssueLiveTicketUseCase } from '../../use-cases/access/issue-live-ticket.ts';
import type { ReadServiceUpdateUseCase } from '../../use-cases/access/read-service-update.ts';
import type { StartServiceUpdateUseCase } from '../../use-cases/access/start-service-update.ts';
import type { Limits } from '../../config/limits.ts';
import type { FastifyInstance } from 'fastify';
import type { BrowseProjectFoldersUseCase } from '../../use-cases/projects/browse-project-folders.ts';
import type { CreateCommentThreadUseCase } from '../../use-cases/reviews/create-comment-thread.ts';
import type { DeleteCommentMessageUseCase } from '../../use-cases/reviews/delete-comment-message.ts';
import type { DeleteResolvedCommentsUseCase } from '../../use-cases/reviews/delete-resolved-comments.ts';
import type { EditCommentMessageUseCase } from '../../use-cases/reviews/edit-comment-message.ts';
import type { DismissInterruptedGitActionUseCase } from '../../use-cases/git-actions/dismiss-interrupted-git-action.ts';
import type { EditFileUseCase } from '../../use-cases/files/edit-file.ts';
import type { GenerateCommitDraftUseCase } from '../../use-cases/git-actions/generate-commit-draft.ts';
import type { ListCommentThreadsUseCase } from '../../use-cases/reviews/list-comment-threads.ts';
import type { ListCommitModelsUseCase } from '../../use-cases/git-actions/list-commit-models.ts';
import type { ListCommitsUseCase } from '../../use-cases/changes/list-commits.ts';
import type { ListFileCommitsUseCase } from '../../use-cases/changes/list-file-commits.ts';
import type { ListDirectoryUseCase } from '../../use-cases/files/list-directory.ts';
import type { ListFilePreferencesUseCase } from '../../use-cases/projects/list-file-preferences.ts';
import type { ListReviewedFilesUseCase } from '../../use-cases/reviews/list-reviewed-files.ts';
import type { ListReviewedLayersUseCase } from '../../use-cases/reviews/list-reviewed-layers.ts';
import type { ListWorktreePathsUseCase } from '../../use-cases/files/list-worktree-paths.ts';
import type { MarkCommentsSeenUseCase } from '../../use-cases/reviews/mark-comments-seen.ts';
import type { PublishReviewUseCase } from '../../use-cases/reviews/publish-review.ts';
import type { ReadChangeDiffsUseCase } from '../../use-cases/changes/read-change-diffs.ts';
import type { ReadChangeLinesUseCase } from '../../use-cases/changes/read-change-lines.ts';
import type { ReadChangesUseCase } from '../../use-cases/changes/read-changes.ts';
import type { ReadCommitDiffsUseCase } from '../../use-cases/changes/read-commit-diffs.ts';
import type { ReadCommitFilesUseCase } from '../../use-cases/changes/read-commit-files.ts';
import type { ReadFileAssetUseCase } from '../../use-cases/files/read-file-asset.ts';
import type { ReadGitActionReceiptUseCase } from '../../use-cases/git-actions/read-git-action-receipt.ts';
import type { ReadGitStatusUseCase } from '../../use-cases/changes/read-git-status.ts';
import type { ListBranchBasesUseCase } from '../../use-cases/changes/list-branch-bases.ts';
import type { ReadBranchChangesUseCase } from '../../use-cases/changes/read-branch-changes.ts';
import type { ReadBranchDiffsUseCase } from '../../use-cases/changes/read-branch-diffs.ts';
import type { ReadInventoryUseCase } from '../../use-cases/projects/read-inventory.ts';
import type { ReadPreviewAssetsUseCase } from '../../use-cases/files/read-preview-assets.ts';
import type { ReadProofFileUseCase } from '../../use-cases/reviews/read-proof-file.ts';
import type { ReadPublishedReviewUseCase } from '../../use-cases/reviews/read-published-review.ts';
import type { ReadTextFileUseCase } from '../../use-cases/files/read-text-file.ts';
import type { RegisterProjectUseCase } from '../../use-cases/projects/register-project.ts';
import type { RemoveProjectUseCase } from '../../use-cases/projects/remove-project.ts';
import type { RemoveReviewedFilesUseCase } from '../../use-cases/reviews/remove-reviewed-files.ts';
import type { RemoveReviewedLayerUseCase } from '../../use-cases/reviews/remove-reviewed-layer.ts';
import type { RenameProjectUseCase } from '../../use-cases/projects/rename-project.ts';
import type { ReplyToCommentUseCase } from '../../use-cases/reviews/reply-to-comment.ts';
import type { UpdateCommentThreadUseCase } from '../../use-cases/reviews/update-comment-thread.ts';
import type { RunGitActionUseCase } from '../../use-cases/git-actions/run-git-action.ts';
import type { SetFilePreferenceUseCase } from '../../use-cases/projects/set-file-preference.ts';
import type { SetReviewedFilesUseCase } from '../../use-cases/reviews/set-reviewed-files.ts';
import type { SetReviewedLayerUseCase } from '../../use-cases/reviews/set-reviewed-layer.ts';
import {
  authenticate,
  type AuthenticateOptions,
} from '../hooks/authenticate.ts';
import {
  recognizeLocalRequest,
  type LocalDeviceOptions,
} from '../hooks/local-device.ts';
import { issueLiveTicket } from '../routes/access/issue-live-ticket.ts';
import { startServiceUpdate } from '../routes/access/start-service-update.ts';
import { listCommits } from '../routes/changes/list-commits.ts';
import { listFileCommits } from '../routes/changes/list-file-commits.ts';
import { readCommitFiles } from '../routes/changes/read-commit-files.ts';
import { readCommitDiffs } from '../routes/changes/read-commit-diffs.ts';
import { listBranchBases } from '../routes/changes/list-branch-bases.ts';
import { readBranchChanges } from '../routes/changes/read-branch-changes.ts';
import { readBranchDiffs } from '../routes/changes/read-branch-diffs.ts';
import { editFile } from '../routes/files/edit-file.ts';
import { listDirectory } from '../routes/files/list-directory.ts';
import { listWorktreePaths } from '../routes/files/list-worktree-paths.ts';
import { readFileAsset } from '../routes/files/read-file-asset.ts';
import { readPreviewAssets } from '../routes/files/read-preview-assets.ts';
import { readTextFile } from '../routes/files/read-text-file.ts';
import { dismissInterruptedGitAction } from '../routes/git-actions/dismiss-interrupted-git-action.ts';
import { generateCommitDraft } from '../routes/git-actions/generate-commit-draft.ts';
import { listCommitModels } from '../routes/git-actions/list-commit-models.ts';
import { readGitActionReceipt } from '../routes/git-actions/read-git-action-receipt.ts';
import { runGitAction } from '../routes/git-actions/run-git-action.ts';
import { readChanges } from '../routes/changes/read-changes.ts';
import { readChangeDiffs } from '../routes/changes/read-change-diffs.ts';
import { readChangeLines } from '../routes/changes/read-change-lines.ts';
import { readGitStatus } from '../routes/changes/read-git-status.ts';
import { browseProjectFolders } from '../routes/projects/browse-project-folders.ts';
import { listFilePreferences } from '../routes/projects/list-file-preferences.ts';
import { readInventory } from '../routes/projects/read-inventory.ts';
import { registerProject } from '../routes/projects/register-project.ts';
import { removeProject } from '../routes/projects/remove-project.ts';
import { renameProject } from '../routes/projects/rename-project.ts';
import { setFilePreference } from '../routes/projects/set-file-preference.ts';
import { createCommentThread } from '../routes/reviews/create-comment-thread.ts';
import { deleteCommentMessage } from '../routes/reviews/delete-comment-message.ts';
import { deleteResolvedComments } from '../routes/reviews/delete-resolved-comments.ts';
import { editCommentMessage } from '../routes/reviews/edit-comment-message.ts';
import { listCommentThreads } from '../routes/reviews/list-comment-threads.ts';
import { markCommentsSeen } from '../routes/reviews/mark-comments-seen.ts';
import { publishReview } from '../routes/reviews/publish-review.ts';
import { readProofFile } from '../routes/reviews/read-proof-file.ts';
import { readPublishedReview } from '../routes/reviews/read-published-review.ts';
import { listReviewedFiles } from '../routes/reviews/list-reviewed-files.ts';
import { listReviewedLayers } from '../routes/reviews/list-reviewed-layers.ts';
import { removeReviewedFile } from '../routes/reviews/remove-reviewed-file.ts';
import { removeReviewedFiles } from '../routes/reviews/remove-reviewed-files.ts';
import { removeReviewedLayer } from '../routes/reviews/remove-reviewed-layer.ts';
import { readServiceUpdate } from '../routes/access/read-service-update.ts';
import { replyToComment } from '../routes/reviews/reply-to-comment.ts';
import { updateCommentThread } from '../routes/reviews/update-comment-thread.ts';
import { setReviewedFile } from '../routes/reviews/set-reviewed-file.ts';
import { setReviewedFiles } from '../routes/reviews/set-reviewed-files.ts';
import { setReviewedLayer } from '../routes/reviews/set-reviewed-layer.ts';

export type PairedUseCases = {
  access: LocalDeviceOptions['access'] & {
    readServiceUpdate: Pick<ReadServiceUpdateUseCase, 'execute'>;
    startServiceUpdate: Pick<StartServiceUpdateUseCase, 'execute'>;
    issueLiveTicket: Pick<IssueLiveTicketUseCase, 'execute'>;
  };
  projects: {
    browseProjectFolders: Pick<BrowseProjectFoldersUseCase, 'execute'>;
    listFilePreferences: Pick<ListFilePreferencesUseCase, 'execute'>;
    readInventory: Pick<ReadInventoryUseCase, 'execute'>;
    registerProject: Pick<RegisterProjectUseCase, 'execute'>;
    removeProject: Pick<RemoveProjectUseCase, 'execute'>;
    renameProject: Pick<RenameProjectUseCase, 'execute'>;
    setFilePreference: Pick<SetFilePreferenceUseCase, 'execute'>;
  };
  files: {
    editFile: Pick<EditFileUseCase, 'execute'>;
    listDirectory: Pick<ListDirectoryUseCase, 'execute'>;
    listWorktreePaths: Pick<ListWorktreePathsUseCase, 'execute'>;
    readFileAsset: Pick<ReadFileAssetUseCase, 'execute'>;
    readPreviewAssets: Pick<ReadPreviewAssetsUseCase, 'execute'>;
    readTextFile: Pick<ReadTextFileUseCase, 'execute'>;
  };
  changes: {
    listBranchBases: Pick<ListBranchBasesUseCase, 'execute'>;
    listCommits: Pick<ListCommitsUseCase, 'execute'>;
    listFileCommits: Pick<ListFileCommitsUseCase, 'execute'>;
    readBranchChanges: Pick<ReadBranchChangesUseCase, 'execute'>;
    readBranchDiffs: Pick<ReadBranchDiffsUseCase, 'execute'>;
    readChangeDiffs: Pick<ReadChangeDiffsUseCase, 'execute'>;
    readChangeLines: Pick<ReadChangeLinesUseCase, 'execute'>;
    readChanges: Pick<ReadChangesUseCase, 'execute'>;
    readCommitDiffs: Pick<ReadCommitDiffsUseCase, 'execute'>;
    readCommitFiles: Pick<ReadCommitFilesUseCase, 'execute'>;
    readGitStatus: Pick<ReadGitStatusUseCase, 'execute'>;
  };
  reviews: {
    createCommentThread: Pick<CreateCommentThreadUseCase, 'execute'>;
    deleteCommentMessage: Pick<DeleteCommentMessageUseCase, 'execute'>;
    deleteResolvedComments: Pick<DeleteResolvedCommentsUseCase, 'execute'>;
    editCommentMessage: Pick<EditCommentMessageUseCase, 'execute'>;
    listCommentThreads: Pick<ListCommentThreadsUseCase, 'execute'>;
    listReviewedFiles: Pick<ListReviewedFilesUseCase, 'execute'>;
    listReviewedLayers: Pick<ListReviewedLayersUseCase, 'execute'>;
    markCommentsSeen: Pick<MarkCommentsSeenUseCase, 'execute'>;
    publishReview: Pick<PublishReviewUseCase, 'execute'>;
    readPublishedReview: Pick<ReadPublishedReviewUseCase, 'execute'>;
    readProofFile: Pick<ReadProofFileUseCase, 'execute'>;
    removeReviewedFiles: Pick<RemoveReviewedFilesUseCase, 'execute'>;
    removeReviewedLayer: Pick<RemoveReviewedLayerUseCase, 'execute'>;
    replyToComment: Pick<ReplyToCommentUseCase, 'execute'>;
    updateCommentThread: Pick<UpdateCommentThreadUseCase, 'execute'>;
    setReviewedFiles: Pick<SetReviewedFilesUseCase, 'execute'>;
    setReviewedLayer: Pick<SetReviewedLayerUseCase, 'execute'>;
  };
  gitActions: {
    dismissInterruptedGitAction: Pick<
      DismissInterruptedGitActionUseCase,
      'execute'
    >;
    generateCommitDraft: Pick<GenerateCommitDraftUseCase, 'execute'>;
    listCommitModels: Pick<ListCommitModelsUseCase, 'execute'>;
    readGitActionReceipt: Pick<ReadGitActionReceiptUseCase, 'execute'>;
    runGitAction: Pick<RunGitActionUseCase, 'execute'>;
  };
};

export async function pairedScope(
  server: FastifyInstance,
  options: {
    application: PairedUseCases & AuthenticateOptions;
    limits: Limits;
  },
) {
  server.addHook(
    'onRequest',
    authenticate(options.application, {
      cookieMaxAgeSeconds: options.limits.access.device.cookieMaxAgeSeconds,
    }),
  );
  server.register(async (updates) => {
    updates.addHook('onRequest', recognizeLocalRequest(options.application));
    updates.register(readServiceUpdate, {
      useCase: options.application.access.readServiceUpdate,
    });
    updates.register(startServiceUpdate, {
      useCase: options.application.access.startServiceUpdate,
    });
  });
  server.register(issueLiveTicket, {
    useCase: options.application.access.issueLiveTicket,
  });
  server.register(runGitAction, {
    useCase: options.application.gitActions.runGitAction,
  });
  server.register(readGitActionReceipt, {
    useCase: options.application.gitActions.readGitActionReceipt,
  });
  server.register(dismissInterruptedGitAction, {
    useCase: options.application.gitActions.dismissInterruptedGitAction,
  });
  server.register(listCommitModels, {
    useCase: options.application.gitActions.listCommitModels,
  });
  server.register(generateCommitDraft, {
    useCase: options.application.gitActions.generateCommitDraft,
  });
  server.register(readChanges, {
    useCase: options.application.changes.readChanges,
  });
  server.register(readChangeDiffs, {
    useCase: options.application.changes.readChangeDiffs,
  });
  server.register(readChangeLines, {
    useCase: options.application.changes.readChangeLines,
  });
  server.register(readGitStatus, {
    useCase: options.application.changes.readGitStatus,
  });
  server.register(listReviewedFiles, {
    useCase: options.application.reviews.listReviewedFiles,
  });
  server.register(setReviewedFile, {
    useCase: options.application.reviews.setReviewedFiles,
  });
  server.register(setReviewedFiles, {
    useCase: options.application.reviews.setReviewedFiles,
  });
  server.register(removeReviewedFile, {
    useCase: options.application.reviews.removeReviewedFiles,
  });
  server.register(removeReviewedFiles, {
    useCase: options.application.reviews.removeReviewedFiles,
  });
  server.register(listReviewedLayers, {
    useCase: options.application.reviews.listReviewedLayers,
  });
  server.register(setReviewedLayer, {
    useCase: options.application.reviews.setReviewedLayer,
  });
  server.register(removeReviewedLayer, {
    useCase: options.application.reviews.removeReviewedLayer,
  });
  server.register(readPublishedReview, {
    useCase: options.application.reviews.readPublishedReview,
  });
  server.register(readProofFile, {
    useCase: options.application.reviews.readProofFile,
  });
  server.register(publishReview, {
    useCase: options.application.reviews.publishReview,
    limits: options.limits.http,
  });
  server.register(listCommentThreads, {
    useCase: options.application.reviews.listCommentThreads,
  });
  server.register(createCommentThread, {
    useCase: options.application.reviews.createCommentThread,
  });
  server.register(replyToComment, {
    useCase: options.application.reviews.replyToComment,
  });
  server.register(updateCommentThread, {
    useCase: options.application.reviews.updateCommentThread,
  });
  server.register(editCommentMessage, {
    useCase: options.application.reviews.editCommentMessage,
  });
  server.register(deleteCommentMessage, {
    useCase: options.application.reviews.deleteCommentMessage,
  });
  server.register(deleteResolvedComments, {
    useCase: options.application.reviews.deleteResolvedComments,
  });
  server.register(markCommentsSeen, {
    useCase: options.application.reviews.markCommentsSeen,
  });
  server.register(listDirectory, {
    useCase: options.application.files.listDirectory,
  });
  server.register(readTextFile, {
    useCase: options.application.files.readTextFile,
  });
  server.register(readFileAsset, {
    useCase: options.application.files.readFileAsset,
  });
  server.register(readPreviewAssets, {
    useCase: options.application.files.readPreviewAssets,
  });
  server.register(editFile, {
    useCase: options.application.files.editFile,
    limits: options.limits.http,
  });
  server.register(listWorktreePaths, {
    useCase: options.application.files.listWorktreePaths,
  });
  server.register(browseProjectFolders, {
    useCase: options.application.projects.browseProjectFolders,
  });
  server.register(readInventory, {
    useCase: options.application.projects.readInventory,
  });
  server.register(removeProject, {
    useCase: options.application.projects.removeProject,
  });
  server.register(listFilePreferences, {
    useCase: options.application.projects.listFilePreferences,
  });
  server.register(setFilePreference, {
    useCase: options.application.projects.setFilePreference,
  });
  server.register(registerProject, {
    useCase: options.application.projects.registerProject,
  });
  server.register(renameProject, {
    useCase: options.application.projects.renameProject,
  });
  server.register(listCommits, {
    useCase: options.application.changes.listCommits,
  });
  server.register(listFileCommits, {
    useCase: options.application.changes.listFileCommits,
  });
  server.register(readCommitFiles, {
    useCase: options.application.changes.readCommitFiles,
  });
  server.register(readCommitDiffs, {
    useCase: options.application.changes.readCommitDiffs,
  });
  server.register(readBranchChanges, {
    useCase: options.application.changes.readBranchChanges,
  });
  server.register(readBranchDiffs, {
    useCase: options.application.changes.readBranchDiffs,
  });
  server.register(listBranchBases, {
    useCase: options.application.changes.listBranchBases,
  });
}
