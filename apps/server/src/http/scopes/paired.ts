import type { FastifyInstance } from 'fastify';
import type { BrowseProjectFoldersController } from '../../controllers/browse-project-folders-controller.ts';
import type { CreateCommentThreadController } from '../../controllers/create-comment-thread-controller.ts';
import type { DiscoverProjectsController } from '../../controllers/discover-projects-controller.ts';
import type { DismissInterruptedGitActionController } from '../../controllers/dismiss-interrupted-git-action-controller.ts';
import type { EditFileController } from '../../controllers/edit-file-controller.ts';
import type { GenerateCommitDraftController } from '../../controllers/generate-commit-draft-controller.ts';
import type { ListCommentThreadsController } from '../../controllers/list-comment-threads-controller.ts';
import type { ListCommitModelsController } from '../../controllers/list-commit-models-controller.ts';
import type { ListCommitsController } from '../../controllers/list-commits-controller.ts';
import type { ListDirectoryController } from '../../controllers/list-directory-controller.ts';
import type { ListFilePreferencesController } from '../../controllers/list-file-preferences-controller.ts';
import type { ListGitBranchesController } from '../../controllers/list-git-branches-controller.ts';
import type { ListReviewedFilesController } from '../../controllers/list-reviewed-files-controller.ts';
import type { ListReviewedLayersController } from '../../controllers/list-reviewed-layers-controller.ts';
import type { ListWorktreePathsController } from '../../controllers/list-worktree-paths-controller.ts';
import type { MarkCommentsSeenController } from '../../controllers/mark-comments-seen-controller.ts';
import type { PublishReviewController } from '../../controllers/publish-review-controller.ts';
import type { ReadChangeDiffsController } from '../../controllers/read-change-diffs-controller.ts';
import type { ReadChangeLinesController } from '../../controllers/read-change-lines-controller.ts';
import type { ReadChangesController } from '../../controllers/read-changes-controller.ts';
import type { ReadCommitDiffsController } from '../../controllers/read-commit-diffs-controller.ts';
import type { ReadCommitFilesController } from '../../controllers/read-commit-files-controller.ts';
import type { ReadFileAssetController } from '../../controllers/read-file-asset-controller.ts';
import type { ReadGitActionReceiptController } from '../../controllers/read-git-action-receipt-controller.ts';
import type { ReadGitStatusController } from '../../controllers/read-git-status-controller.ts';
import type { ReadInventoryController } from '../../controllers/read-inventory-controller.ts';
import type { ReadPreviewAssetsController } from '../../controllers/read-preview-assets-controller.ts';
import type { ReadPublishedReviewController } from '../../controllers/read-published-review-controller.ts';
import type { ReadTextFileController } from '../../controllers/read-text-file-controller.ts';
import type { RegisterProjectController } from '../../controllers/register-project-controller.ts';
import type { RemoveProjectController } from '../../controllers/remove-project-controller.ts';
import type { RemoveReviewedFileController } from '../../controllers/remove-reviewed-file-controller.ts';
import type { RemoveReviewedLayerController } from '../../controllers/remove-reviewed-layer-controller.ts';
import type { RenameProjectController } from '../../controllers/rename-project-controller.ts';
import type { ReplyToCommentController } from '../../controllers/reply-to-comment-controller.ts';
import type { ResolveCommentThreadController } from '../../controllers/resolve-comment-thread-controller.ts';
import type { RunGitActionController } from '../../controllers/run-git-action-controller.ts';
import type { SetFilePreferenceController } from '../../controllers/set-file-preference-controller.ts';
import type { SetReviewedFileController } from '../../controllers/set-reviewed-file-controller.ts';
import type { SetReviewedFilesController } from '../../controllers/set-reviewed-files-controller.ts';
import type { SetReviewedLayerController } from '../../controllers/set-reviewed-layer-controller.ts';
import {
  authenticate,
  type AuthenticateOptions,
} from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
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

export type PairedControllers = {
  browseProjectFoldersController: Pick<
    BrowseProjectFoldersController,
    'execute'
  >;
  createCommentThreadController: Pick<CreateCommentThreadController, 'execute'>;
  discoverProjectsController: Pick<DiscoverProjectsController, 'execute'>;
  dismissInterruptedGitActionController: Pick<
    DismissInterruptedGitActionController,
    'execute'
  >;
  editFileController: Pick<EditFileController, 'execute'>;
  generateCommitDraftController: Pick<GenerateCommitDraftController, 'execute'>;
  listCommentThreadsController: Pick<ListCommentThreadsController, 'execute'>;
  listCommitModelsController: Pick<ListCommitModelsController, 'execute'>;
  listCommitsController: Pick<ListCommitsController, 'execute'>;
  listDirectoryController: Pick<ListDirectoryController, 'execute'>;
  listFilePreferencesController: Pick<ListFilePreferencesController, 'execute'>;
  listGitBranchesController: Pick<ListGitBranchesController, 'execute'>;
  listReviewedFilesController: Pick<ListReviewedFilesController, 'execute'>;
  listReviewedLayersController: Pick<ListReviewedLayersController, 'execute'>;
  listWorktreePathsController: Pick<ListWorktreePathsController, 'execute'>;
  markCommentsSeenController: Pick<MarkCommentsSeenController, 'execute'>;
  publishReviewController: Pick<PublishReviewController, 'execute'>;
  readChangeDiffsController: Pick<ReadChangeDiffsController, 'execute'>;
  readChangeLinesController: Pick<ReadChangeLinesController, 'execute'>;
  readChangesController: Pick<ReadChangesController, 'execute'>;
  readCommitDiffsController: Pick<ReadCommitDiffsController, 'execute'>;
  readCommitFilesController: Pick<ReadCommitFilesController, 'execute'>;
  readFileAssetController: Pick<ReadFileAssetController, 'execute'>;
  readGitActionReceiptController: Pick<
    ReadGitActionReceiptController,
    'execute'
  >;
  readGitStatusController: Pick<ReadGitStatusController, 'execute'>;
  readInventoryController: Pick<ReadInventoryController, 'execute'>;
  readPreviewAssetsController: Pick<ReadPreviewAssetsController, 'execute'>;
  readPublishedReviewController: Pick<ReadPublishedReviewController, 'execute'>;
  readTextFileController: Pick<ReadTextFileController, 'execute'>;
  registerProjectController: Pick<RegisterProjectController, 'execute'>;
  removeProjectController: Pick<RemoveProjectController, 'execute'>;
  removeReviewedFileController: Pick<RemoveReviewedFileController, 'execute'>;
  removeReviewedLayerController: Pick<RemoveReviewedLayerController, 'execute'>;
  renameProjectController: Pick<RenameProjectController, 'execute'>;
  replyToCommentController: Pick<ReplyToCommentController, 'execute'>;
  resolveCommentThreadController: Pick<
    ResolveCommentThreadController,
    'execute'
  >;
  runGitActionController: Pick<RunGitActionController, 'execute'>;
  setFilePreferenceController: Pick<SetFilePreferenceController, 'execute'>;
  setReviewedFileController: Pick<SetReviewedFileController, 'execute'>;
  setReviewedFilesController: Pick<SetReviewedFilesController, 'execute'>;
  setReviewedLayerController: Pick<SetReviewedLayerController, 'execute'>;
};

export async function pairedRoutes(
  server: FastifyInstance,
  options: { application: PairedControllers & AuthenticateOptions },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options.application));
  server.register(runAction, {
    controller: options.application.runGitActionController,
  });
  server.register(readReceipt, {
    controller: options.application.readGitActionReceiptController,
  });
  server.register(dismissInterrupted, {
    controller: options.application.dismissInterruptedGitActionController,
  });
  server.register(listBranches, {
    controller: options.application.listGitBranchesController,
  });
  server.register(listCommitModels, {
    controller: options.application.listCommitModelsController,
  });
  server.register(generateCommitDraft, {
    controller: options.application.generateCommitDraftController,
  });
  server.register(readChanges, {
    controller: options.application.readChangesController,
  });
  server.register(readChangeDiffs, {
    controller: options.application.readChangeDiffsController,
  });
  server.register(readChangeLines, {
    controller: options.application.readChangeLinesController,
  });
  server.register(readGitStatus, {
    controller: options.application.readGitStatusController,
  });
  server.register(listReviewedFiles, {
    controller: options.application.listReviewedFilesController,
  });
  server.register(setReviewedFile, {
    controller: options.application.setReviewedFileController,
  });
  server.register(setReviewedFiles, {
    controller: options.application.setReviewedFilesController,
  });
  server.register(removeReviewedFile, {
    controller: options.application.removeReviewedFileController,
  });
  server.register(listReviewedLayers, {
    controller: options.application.listReviewedLayersController,
  });
  server.register(setReviewedLayer, {
    controller: options.application.setReviewedLayerController,
  });
  server.register(removeReviewedLayer, {
    controller: options.application.removeReviewedLayerController,
  });
  server.register(readPublishedReview, {
    controller: options.application.readPublishedReviewController,
  });
  server.register(publishReview, {
    controller: options.application.publishReviewController,
  });
  server.register(listCommentThreads, {
    controller: options.application.listCommentThreadsController,
  });
  server.register(createCommentThread, {
    controller: options.application.createCommentThreadController,
  });
  server.register(replyToComment, {
    controller: options.application.replyToCommentController,
  });
  server.register(resolveCommentThread, {
    controller: options.application.resolveCommentThreadController,
  });
  server.register(markCommentsSeen, {
    controller: options.application.markCommentsSeenController,
  });
  server.register(listDirectory, {
    controller: options.application.listDirectoryController,
  });
  server.register(readTextFile, {
    controller: options.application.readTextFileController,
  });
  server.register(readFileAsset, {
    controller: options.application.readFileAssetController,
  });
  server.register(readPreviewAssets, {
    controller: options.application.readPreviewAssetsController,
  });
  server.register(editFile, {
    controller: options.application.editFileController,
  });
  server.register(listWorktreePaths, {
    controller: options.application.listWorktreePathsController,
  });
  server.register(discoverProjects, {
    controller: options.application.discoverProjectsController,
  });
  server.register(browseProjectFolders, {
    controller: options.application.browseProjectFoldersController,
  });
  server.register(readInventory, {
    controller: options.application.readInventoryController,
  });
  server.register(removeProject, {
    controller: options.application.removeProjectController,
  });
  server.register(listFilePreferences, {
    controller: options.application.listFilePreferencesController,
  });
  server.register(setFilePreference, {
    controller: options.application.setFilePreferenceController,
  });
  server.register(registerProject, {
    controller: options.application.registerProjectController,
  });
  server.register(renameProject, {
    controller: options.application.renameProjectController,
  });
  server.register(listCommits, {
    controller: options.application.listCommitsController,
  });
  server.register(readCommitFiles, {
    controller: options.application.readCommitFilesController,
  });
  server.register(readCommitDiffs, {
    controller: options.application.readCommitDiffsController,
  });
}
