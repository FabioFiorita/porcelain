import {
  EditFileService,
  ListDirectoryService,
  ListWorktreePathsService,
  ReadFileAssetService,
  ReadPreviewAssetsService,
} from '@porcelain/files/services';
import { gitDirectoryName, temporaryWriteName } from '@porcelain/kernel/rules';
import { FilesystemDirectoryReader } from '../adapters/files/filesystem-directory-reader.ts';
import { FilesystemFileWriter } from '../adapters/files/filesystem-file-writer.ts';
import { GitIgnoredEntriesReader } from '../adapters/files/git-ignored-entries-reader.ts';
import { GitWorktreePathsReader } from '../adapters/files/git-worktree-paths-reader.ts';
import { filesRoutes } from '../http/routes/files/files-api.ts';
import type { CheckWorktreeUseCasePort } from '../ports/check-worktree-use-case-port.ts';
import type { EditAnnouncementWriter } from '../ports/edit-announcement-writer.ts';
import type { InvalidateReviewedMarksUseCasePort } from '../ports/invalidate-reviewed-marks-use-case-port.ts';
import { WorktreeAccess } from '../runtime/worktree-access.ts';
import { EditFileUseCase } from '../use-cases/files/edit-file.ts';
import { ListDirectoryUseCase } from '../use-cases/files/list-directory.ts';
import { ListWorktreePathsUseCase } from '../use-cases/files/list-worktree-paths.ts';
import { ReadFileAssetUseCase } from '../use-cases/files/read-file-asset.ts';
import { ReadPreviewAssetsUseCase } from '../use-cases/files/read-preview-assets.ts';
import { ReadTextFileUseCase } from '../use-cases/files/read-text-file.ts';
import type { ComposeContext } from './compose-context.ts';
import type { Shared } from './compose-shared.ts';

type FilesDependencies = {
  shared: Shared;
  checkWorktree: CheckWorktreeUseCasePort;
  invalidateReviewedMarks: InvalidateReviewedMarksUseCasePort;
  editAnnouncements: EditAnnouncementWriter;
};

export function composeFiles(
  context: ComposeContext,
  dependencies: FilesDependencies,
) {
  const { laneKeys, events, logger } = context;
  const { limits } = context.settings;
  const { worktreeAccess, fileReader } = dependencies.shared;
  const { lanes } = context;
  const access = new WorktreeAccess(
    dependencies.checkWorktree,
    dependencies.shared.confirmWorktree,
    lanes,
    laneKeys,
  );
  const useCases = {
    listDirectory: new ListDirectoryUseCase(
      access,
      new ListDirectoryService(
        new FilesystemDirectoryReader(worktreeAccess, {
          gitDirectory: gitDirectoryName(),
        }),
        new GitIgnoredEntriesReader(worktreeAccess, limits.git),
        limits.files.listDirectory,
      ),
    ),
    readTextFile: new ReadTextFileUseCase(
      access,
      dependencies.shared.readTextFileService,
    ),
    readFileAsset: new ReadFileAssetUseCase(
      access,
      new ReadFileAssetService(fileReader, limits.files.readFileAsset),
    ),
    readPreviewAssets: new ReadPreviewAssetsUseCase(
      access,
      new ReadPreviewAssetsService(fileReader, limits.files.readPreviewAssets),
    ),
    editFile: new EditFileUseCase(
      access,
      new EditFileService(
        fileReader,
        new FilesystemFileWriter(worktreeAccess, {
          ...limits.files.permissions,
          temporaryName: temporaryWriteName,
        }),
        limits.files.editFile,
      ),
      dependencies.invalidateReviewedMarks,
      events,
      dependencies.editAnnouncements,
      logger,
    ),
    listWorktreePaths: new ListWorktreePathsUseCase(
      access,
      new ListWorktreePathsService(
        new GitWorktreePathsReader(worktreeAccess, limits.git),
      ),
    ),
  };
  return filesRoutes(useCases, limits.http);
}
