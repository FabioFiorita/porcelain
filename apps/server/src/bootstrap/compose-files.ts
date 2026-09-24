import {
  EditFileService,
  ListDirectoryService,
  ListWorktreePathsService,
  ReadFileAssetService,
  ReadPreviewAssetsService,
  ReadTextFileService,
} from '@porcelain/files/services';
import type { ListedWorktree } from '@porcelain/projects/models';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type { InvalidateReviewedMarksService } from '@porcelain/reviews/services';
import type { InspectionFactory } from '@porcelain/git/inspection';
import type { WorktreeAccessReader } from '@porcelain/kernel/ports';
import { FilesystemDirectoryReader } from '../adapters/files/filesystem-directory-reader.ts';
import { FilesystemFileReader } from '../adapters/files/filesystem-file-reader.ts';
import { inspectionCheckouts } from '../adapters/changes/inspection-checkouts.ts';
import { FilesystemFileWriter } from '../adapters/files/filesystem-file-writer.ts';
import { GitHeadTextReader } from '../adapters/files/git-head-text-reader.ts';
import { GitIgnoredEntriesReader } from '../adapters/files/git-ignored-entries-reader.ts';
import { GitWorktreePathsReader } from '../adapters/files/git-worktree-paths-reader.ts';
import { EditFileUseCase } from '../use-cases/files/edit-file.ts';
import { ListDirectoryUseCase } from '../use-cases/files/list-directory.ts';
import { ListWorktreePathsUseCase } from '../use-cases/files/list-worktree-paths.ts';
import { ReadFileAssetUseCase } from '../use-cases/files/read-file-asset.ts';
import { ReadPreviewAssetsUseCase } from '../use-cases/files/read-preview-assets.ts';
import { ReadTextFileUseCase } from '../use-cases/files/read-text-file.ts';
import type { ComposeContext } from './compose-context.ts';

export type FilesAdapters = {
  worktreeAccess: WorktreeAccessReader<ListedWorktree>;
  checkWorktree: CheckWorktreeService;
  invalidateReviewedMarks: InvalidateReviewedMarksService;
  inspection: InspectionFactory;
};

export function composeFiles(context: ComposeContext, adapters: FilesAdapters) {
  const { lanes, laneKeys, events } = context;
  const limits = context.settings.limits.files;
  const { worktreeAccess, checkWorktree } = adapters;
  const fileReader = new FilesystemFileReader(worktreeAccess);
  const readTextFileService = new ReadTextFileService(
    fileReader,
    new GitHeadTextReader(
      inspectionCheckouts(worktreeAccess, adapters.inspection),
    ),
    limits.readTextFile,
  );
  return {
    fileReader,
    readTextFileService,
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
      readTextFileService,
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
      new EditFileService(
        fileReader,
        new FilesystemFileWriter(worktreeAccess, limits.permissions),
        limits.editFile,
      ),
      adapters.invalidateReviewedMarks,
      lanes,
      laneKeys,
      events,
    ),
    listWorktreePaths: new ListWorktreePathsUseCase(
      checkWorktree,
      new ListWorktreePathsService(new GitWorktreePathsReader(worktreeAccess)),
      lanes,
      laneKeys,
    ),
  };
}
