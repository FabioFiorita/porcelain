import {
  EditFileService,
  ListDirectoryService,
  ListWorktreePathsService,
  ReadFileAssetService,
  ReadPreviewAssetsService,
} from '@porcelain/files/services';
import { FilesystemDirectoryReader } from '../adapters/files/filesystem-directory-reader.ts';
import { FilesystemFileWriter } from '../adapters/files/filesystem-file-writer.ts';
import { GitIgnoredEntriesReader } from '../adapters/files/git-ignored-entries-reader.ts';
import { GitWorktreePathsReader } from '../adapters/files/git-worktree-paths-reader.ts';
import { EditFileUseCase } from '../use-cases/files/edit-file.ts';
import { ListDirectoryUseCase } from '../use-cases/files/list-directory.ts';
import { ListWorktreePathsUseCase } from '../use-cases/files/list-worktree-paths.ts';
import { ReadFileAssetUseCase } from '../use-cases/files/read-file-asset.ts';
import { ReadPreviewAssetsUseCase } from '../use-cases/files/read-preview-assets.ts';
import { ReadTextFileUseCase } from '../use-cases/files/read-text-file.ts';
import type { AnnouncedEditStore } from '../ports/announced-edit-store.ts';
import type { ReviewedMarksInvalidation } from '../runtime/reviewed-marks-invalidation.ts';
import type { WorktreeCheck } from '../runtime/worktree-check.ts';
import type { ComposeContext } from './compose-context.ts';
import type { Shared } from './compose-shared.ts';

export type FilesDependencies = {
  shared: Shared;
  checkWorktree: WorktreeCheck;
  invalidateReviewedMarks: ReviewedMarksInvalidation;
  announcedEdits: AnnouncedEditStore;
};

export function composeFiles(
  context: ComposeContext,
  dependencies: FilesDependencies,
) {
  const { lanes, laneKeys, events, logger } = context;
  const limits = context.settings.limits.files;
  const { worktreeAccess, fileReader } = dependencies.shared;
  const { checkWorktree } = dependencies;
  return {
    listDirectory: new ListDirectoryUseCase(
      checkWorktree,
      new ListDirectoryService(
        new FilesystemDirectoryReader(worktreeAccess),
        new GitIgnoredEntriesReader(worktreeAccess),
        limits.listDirectory,
      ),
      lanes,
      laneKeys,
    ),
    readTextFile: new ReadTextFileUseCase(
      checkWorktree,
      dependencies.shared.readTextFile,
      lanes,
      laneKeys,
    ),
    readFileAsset: new ReadFileAssetUseCase(
      checkWorktree,
      new ReadFileAssetService(fileReader, limits.readFileAsset),
      lanes,
      laneKeys,
    ),
    readPreviewAssets: new ReadPreviewAssetsUseCase(
      checkWorktree,
      new ReadPreviewAssetsService(fileReader, limits.readPreviewAssets),
      lanes,
      laneKeys,
    ),
    editFile: new EditFileUseCase(
      checkWorktree,
      dependencies.shared.confirmWorktree,
      new EditFileService(
        fileReader,
        new FilesystemFileWriter(worktreeAccess, limits.permissions),
        limits.editFile,
      ),
      dependencies.invalidateReviewedMarks,
      lanes,
      laneKeys,
      events,
      dependencies.announcedEdits,
      logger,
    ),
    listWorktreePaths: new ListWorktreePathsUseCase(
      checkWorktree,
      new ListWorktreePathsService(new GitWorktreePathsReader(worktreeAccess)),
      lanes,
      laneKeys,
    ),
  };
}
