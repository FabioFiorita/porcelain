import type { FastifyInstance } from 'fastify';
import type { BrowseProjectFoldersUseCase } from '../../use-cases/projects/browse-project-folders.ts';
import type { CreateCommentThreadUseCase } from '../../use-cases/reviews/create-comment-thread.ts';
import type { DiscoverProjectsUseCase } from '../../use-cases/projects/discover-projects.ts';
import type { DismissInterruptedGitActionUseCase } from '../../use-cases/git-actions/dismiss-interrupted-git-action.ts';
import type { EditFileUseCase } from '../../use-cases/files/edit-file.ts';
import type { GenerateCommitDraftUseCase } from '../../use-cases/git-actions/generate-commit-draft.ts';
import type { ListCommentThreadsUseCase } from '../../use-cases/reviews/list-comment-threads.ts';
import type { ListCommitModelsUseCase } from '../../use-cases/git-actions/list-commit-models.ts';
import type { ListCommitsUseCase } from '../../use-cases/changes/list-commits.ts';
import type { ListDirectoryUseCase } from '../../use-cases/files/list-directory.ts';
import type { ListFilePreferencesUseCase } from '../../use-cases/projects/list-file-preferences.ts';
import type { ListGitBranchesUseCase } from '../../use-cases/git-actions/list-git-branches.ts';
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
import type { ReadInventoryUseCase } from '../../use-cases/projects/read-inventory.ts';
import type { ReadPreviewAssetsUseCase } from '../../use-cases/files/read-preview-assets.ts';
import type { ReadPublishedReviewUseCase } from '../../use-cases/reviews/read-published-review.ts';
import type { ReadTextFileUseCase } from '../../use-cases/files/read-text-file.ts';
import type { RegisterProjectUseCase } from '../../use-cases/projects/register-project.ts';
import type { RemoveProjectUseCase } from '../../use-cases/projects/remove-project.ts';
import type { RemoveReviewedFileUseCase } from '../../use-cases/reviews/remove-reviewed-file.ts';
import type { RemoveReviewedLayerUseCase } from '../../use-cases/reviews/remove-reviewed-layer.ts';
import type { RenameProjectUseCase } from '../../use-cases/projects/rename-project.ts';
import type { ReplyToCommentUseCase } from '../../use-cases/reviews/reply-to-comment.ts';
import type { ResolveCommentThreadUseCase } from '../../use-cases/reviews/resolve-comment-thread.ts';
import type { RunGitActionUseCase } from '../../use-cases/git-actions/run-git-action.ts';
import type { SetFilePreferenceUseCase } from '../../use-cases/projects/set-file-preference.ts';
import type { SetReviewedFileUseCase } from '../../use-cases/reviews/set-reviewed-file.ts';
import type { SetReviewedFilesUseCase } from '../../use-cases/reviews/set-reviewed-files.ts';
import type { SetReviewedLayerUseCase } from '../../use-cases/reviews/set-reviewed-layer.ts';
import {
  authenticate,
  type AuthenticateOptions,
} from '../hooks/authenticate.ts';
import { listCommits } from '../routes/changes/list-commits.ts';
import { readCommitFiles } from '../routes/changes/read-commit-files.ts';
import { readCommitDiffs } from '../routes/changes/read-commit-diffs.ts';
import { editFile } from '../routes/files/edit-file.ts';
import { listDirectory } from '../routes/files/list-directory.ts';
import { listWorktreePaths } from '../routes/files/list-worktree-paths.ts';
import { readFileAsset } from '../routes/files/read-file-asset.ts';
import { readPreviewAssets } from '../routes/files/read-preview-assets.ts';
import { readTextFile } from '../routes/files/read-text-file.ts';
import { dismissInterrupted } from '../routes/git-actions/dismiss-interrupted.ts';
import { generateCommitDraft } from '../routes/git-actions/generate-commit-draft.ts';
import { listBranches } from '../routes/git-actions/list-branches.ts';
import { listCommitModels } from '../routes/git-actions/list-commit-models.ts';
import { readReceipt } from '../routes/git-actions/read-receipt.ts';
import { runAction } from '../routes/git-actions/run-action.ts';
import { readChanges } from '../routes/changes/read-changes.ts';
import { readChangeDiffs } from '../routes/changes/read-change-diffs.ts';
import { readChangeLines } from '../routes/changes/read-change-lines.ts';
import { readGitStatus } from '../routes/changes/read-git-status.ts';
import { browseProjectFolders } from '../routes/projects/browse-folders.ts';
import { discoverProjects } from '../routes/projects/discover.ts';
import { listFilePreferences } from '../routes/projects/list-file-preferences.ts';
import { readInventory } from '../routes/projects/read-inventory.ts';
import { registerProject } from '../routes/projects/register.ts';
import { removeProject } from '../routes/projects/remove.ts';
import { renameProject } from '../routes/projects/rename.ts';
import { setFilePreference } from '../routes/projects/set-file-preference.ts';
import { createCommentThread } from '../routes/reviews/create-comment-thread.ts';
import { listCommentThreads } from '../routes/reviews/list-comment-threads.ts';
import { markCommentsSeen } from '../routes/reviews/mark-comments-seen.ts';
import { publishReview } from '../routes/reviews/publish-review.ts';
import { readPublishedReview } from '../routes/reviews/read-published-review.ts';
import { listReviewedFiles } from '../routes/reviews/list-reviewed-files.ts';
import { listReviewedLayers } from '../routes/reviews/list-reviewed-layers.ts';
import { removeReviewedFile } from '../routes/reviews/remove-reviewed-file.ts';
import { removeReviewedLayer } from '../routes/reviews/remove-reviewed-layer.ts';
import { replyToComment } from '../routes/reviews/reply-to-comment.ts';
import { resolveCommentThread } from '../routes/reviews/resolve-comment-thread.ts';
import { setReviewedFile } from '../routes/reviews/set-reviewed-file.ts';
import { setReviewedFiles } from '../routes/reviews/set-reviewed-files.ts';
import { setReviewedLayer } from '../routes/reviews/set-reviewed-layer.ts';

export type PairedUseCases = {
  projects: {
    browseProjectFolders: Pick<BrowseProjectFoldersUseCase, 'execute'>;
    discoverProjects: Pick<DiscoverProjectsUseCase, 'execute'>;
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
    listCommits: Pick<ListCommitsUseCase, 'execute'>;
    readChangeDiffs: Pick<ReadChangeDiffsUseCase, 'execute'>;
    readChangeLines: Pick<ReadChangeLinesUseCase, 'execute'>;
    readChanges: Pick<ReadChangesUseCase, 'execute'>;
    readCommitDiffs: Pick<ReadCommitDiffsUseCase, 'execute'>;
    readCommitFiles: Pick<ReadCommitFilesUseCase, 'execute'>;
    readGitStatus: Pick<ReadGitStatusUseCase, 'execute'>;
  };
  reviews: {
    createCommentThread: Pick<CreateCommentThreadUseCase, 'execute'>;
    listCommentThreads: Pick<ListCommentThreadsUseCase, 'execute'>;
    listReviewedFiles: Pick<ListReviewedFilesUseCase, 'execute'>;
    listReviewedLayers: Pick<ListReviewedLayersUseCase, 'execute'>;
    markCommentsSeen: Pick<MarkCommentsSeenUseCase, 'execute'>;
    publishReview: Pick<PublishReviewUseCase, 'execute'>;
    readPublishedReview: Pick<ReadPublishedReviewUseCase, 'execute'>;
    removeReviewedFile: Pick<RemoveReviewedFileUseCase, 'execute'>;
    removeReviewedLayer: Pick<RemoveReviewedLayerUseCase, 'execute'>;
    replyToComment: Pick<ReplyToCommentUseCase, 'execute'>;
    resolveCommentThread: Pick<ResolveCommentThreadUseCase, 'execute'>;
    setReviewedFile: Pick<SetReviewedFileUseCase, 'execute'>;
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
    listGitBranches: Pick<ListGitBranchesUseCase, 'execute'>;
    readGitActionReceipt: Pick<ReadGitActionReceiptUseCase, 'execute'>;
    runGitAction: Pick<RunGitActionUseCase, 'execute'>;
  };
};

export async function pairedScope(
  server: FastifyInstance,
  options: { application: PairedUseCases & AuthenticateOptions },
) {
  server.addHook('onRequest', authenticate(options.application));
  server.register(runAction, {
    useCase: options.application.gitActions.runGitAction,
  });
  server.register(readReceipt, {
    useCase: options.application.gitActions.readGitActionReceipt,
  });
  server.register(dismissInterrupted, {
    useCase: options.application.gitActions.dismissInterruptedGitAction,
  });
  server.register(listBranches, {
    useCase: options.application.gitActions.listGitBranches,
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
    useCase: options.application.reviews.setReviewedFile,
  });
  server.register(setReviewedFiles, {
    useCase: options.application.reviews.setReviewedFiles,
  });
  server.register(removeReviewedFile, {
    useCase: options.application.reviews.removeReviewedFile,
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
  server.register(publishReview, {
    useCase: options.application.reviews.publishReview,
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
  server.register(resolveCommentThread, {
    useCase: options.application.reviews.resolveCommentThread,
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
  });
  server.register(listWorktreePaths, {
    useCase: options.application.files.listWorktreePaths,
  });
  server.register(discoverProjects, {
    useCase: options.application.projects.discoverProjects,
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
  server.register(readCommitFiles, {
    useCase: options.application.changes.readCommitFiles,
  });
  server.register(readCommitDiffs, {
    useCase: options.application.changes.readCommitDiffs,
  });
}
