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
import type { WorktreeAccess } from '@porcelain/kernel/ports';
import { FilesystemDirectoryReader } from '../adapters/files/filesystem-directory-reader.ts';
import { FilesystemFileReader } from '../adapters/files/filesystem-file-reader.ts';
import { FilesystemFileWriter } from '../adapters/files/filesystem-file-writer.ts';
import { GitIgnoredEntriesReader } from '../adapters/files/git-ignored-entries-reader.ts';
import { GitWorktreePathsReader } from '../adapters/files/git-worktree-paths-reader.ts';
import { EditFileUseCase } from '../use-cases/files/edit-file.ts';
import { ListDirectoryUseCase } from '../use-cases/files/list-directory.ts';
import { ListWorktreePathsUseCase } from '../use-cases/files/list-worktree-paths.ts';
import { ReadFileAssetUseCase } from '../use-cases/files/read-file-asset.ts';
import { ReadPreviewAssetsUseCase } from '../use-cases/files/read-preview-assets.ts';
import { ReadTextFileUseCase } from '../use-cases/files/read-text-file.ts';
import type { EventPublisher } from '../ports/event-publisher.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';

const limits = {
  readTextFile: { maxBytes: 1024 * 1024 },
  editFile: { maxCurrentBytes: 1024 * 1024 },
  readFileAsset: { maxBytes: 10 * 1024 * 1024 },
  readPreviewAssets: {
    maxAssetBytes: 10 * 1024 * 1024,
    maxTotalBytes: 16 * 1024 * 1024,
    maxPathLength: 4096,
  },
  listDirectory: { maxEntries: 2000, maxResponseBytes: 1024 * 1024 },
};

export function composeFiles(deps: {
  lanes: Lanes;
  laneKeys: LaneKeys;
  events: EventPublisher;
  worktreeAccess: WorktreeAccess<ListedWorktree>;
  checkWorktree: CheckWorktreeService;
}) {
  const { lanes, laneKeys, events, worktreeAccess, checkWorktree } = deps;
  const fileReader = new FilesystemFileReader(worktreeAccess);
  const readTextFileService = new ReadTextFileService(
    fileReader,
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
        new FilesystemFileWriter(worktreeAccess),
        limits.editFile,
      ),
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
