import {
  CheckWorktreeService,
  EditFileService,
  ListDirectoryService,
  ListWorktreePathsService,
  ReadFileAssetService,
  ReadPreviewAssetsService,
  ReadTextFileService,
} from '@porcelain/files/services';
import type { ListedWorktree } from '@porcelain/projects/models';
import type { WorktreeAccess } from '@porcelain/kernel/ports';
import { DirectoryReaderAdapter } from '../adapters/files/directory-reader-adapter.ts';
import { FileReaderAdapter } from '../adapters/files/file-reader-adapter.ts';
import { FileWriterAdapter } from '../adapters/files/file-writer-adapter.ts';
import { IgnoredEntriesReaderAdapter } from '../adapters/files/ignored-entries-reader-adapter.ts';
import { WorktreePathsReaderAdapter } from '../adapters/files/worktree-paths-reader-adapter.ts';
import { EditFileUseCase } from '../use-cases/files/edit-file.ts';
import { ListDirectoryUseCase } from '../use-cases/files/list-directory.ts';
import { ListWorktreePathsUseCase } from '../use-cases/files/list-worktree-paths.ts';
import { ReadFileAssetUseCase } from '../use-cases/files/read-file-asset.ts';
import { ReadPreviewAssetsUseCase } from '../use-cases/files/read-preview-assets.ts';
import { ReadTextFileUseCase } from '../use-cases/files/read-text-file.ts';
import type { EventPublisher } from '../runtime/event-publisher.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';

export function composeFiles(deps: {
  lanes: Lanes;
  laneKeys: LaneKeys;
  events: EventPublisher;
  worktreeAccess: WorktreeAccess<ListedWorktree>;
}) {
  const { lanes, laneKeys, events, worktreeAccess } = deps;
  const checkWorktree = new CheckWorktreeService(worktreeAccess);
  const fileReader = new FileReaderAdapter(worktreeAccess);
  const readTextFileService = new ReadTextFileService(fileReader);
  return {
    fileReader,
    readTextFileService,
    listDirectory: new ListDirectoryUseCase(
      checkWorktree,
      new ListDirectoryService(
        new DirectoryReaderAdapter(worktreeAccess),
        new IgnoredEntriesReaderAdapter(worktreeAccess),
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
      new ReadFileAssetService(fileReader),
      lanes,
      laneKeys,
    ),
    readPreviewAssets: new ReadPreviewAssetsUseCase(
      checkWorktree,
      new ReadPreviewAssetsService(fileReader),
      lanes,
      laneKeys,
    ),
    editFile: new EditFileUseCase(
      checkWorktree,
      new EditFileService(fileReader, new FileWriterAdapter(worktreeAccess)),
      lanes,
      laneKeys,
      events,
    ),
    listWorktreePaths: new ListWorktreePathsUseCase(
      checkWorktree,
      new ListWorktreePathsService(
        new WorktreePathsReaderAdapter(worktreeAccess),
      ),
      lanes,
      laneKeys,
    ),
  };
}
