import type { FastifyInstance } from 'fastify';
import type { ServerCapabilities } from '../../bootstrap/server-capabilities.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { listCommits } from '../routes/changes/list-commits.ts';
import { readCommitFiles } from '../routes/changes/read-commit-files.ts';
import { readCommitDiffs } from '../routes/changes/read-commit-diffs.ts';
import { editFile } from '../routes/files/edit-file.ts';
import { listDirectory } from '../routes/files/list-directory.ts';
import { listWorktreePaths } from '../routes/files/list-worktree-paths.ts';
import { readAsset } from '../routes/files/read-asset.ts';
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

export async function pairedRoutes(
  server: FastifyInstance,
  options: { application: ServerCapabilities },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options));
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
    controller: options.application.commentThreadsController,
  });
  server.register(createCommentThread, {
    controller: options.application.commentThreadsController,
  });
  server.register(replyToComment, {
    controller: options.application.commentThreadsController,
  });
  server.register(resolveCommentThread, {
    controller: options.application.commentThreadsController,
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
  server.register(readAsset, {
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
    controller: options.application.projects,
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
