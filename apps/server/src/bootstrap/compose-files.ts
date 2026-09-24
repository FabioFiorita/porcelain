import { gitDirectoryName, temporaryWriteName } from '@porcelain/kernel/rules';
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
import type { InvalidateReviewedMarksUseCasePort } from '../ports/invalidate-reviewed-marks-use-case-port.ts';
import type { CheckWorktreeUseCasePort } from '../ports/check-worktree-use-case-port.ts';
import type { ComposeContext } from './compose-context.ts';
import type { Shared } from './compose-shared.ts';

export type FilesDependencies = {
  shared: Shared;
  checkWorktree: CheckWorktreeUseCasePort;
  invalidateReviewedMarks: InvalidateReviewedMarksUseCasePort;
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
        new FilesystemDirectoryReader(worktreeAccess, {
          gitDirectory: gitDirectoryName(),
        }),
        new GitIgnoredEntriesReader(
          worktreeAccess,
          context.settings.limits.git,
        ),
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
        new FilesystemFileWriter(worktreeAccess, {
          ...limits.permissions,
          temporaryName: temporaryWriteName,
        }),
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
      new ListWorktreePathsService(
        new GitWorktreePathsReader(worktreeAccess, context.settings.limits.git),
      ),
      lanes,
      laneKeys,
    ),
  };
}
